import type { Express, Request, Response } from "express";
import express from "express";
import crypto from "crypto";
import type { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../utils/helpers/encryption";
import {
  downloadWhatsAppMedia,
  fetchWhatsAppMediaUrl,
  verifyWhatsAppSignature,
} from "../utils/intregrations/whatsapp";
import { uploadBufferToStorage } from "../utils/intregrations/s3Storage";
import { findByPhone } from "../utils/whatsapp/matchPhone";

const WEBHOOK_PATH = "/webhooks/whatsapp";

type WhatsAppWebhookMediaRef = { id?: string; caption?: string; filename?: string; mime_type?: string };

type WhatsAppWebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: WhatsAppWebhookMediaRef;
  document?: WhatsAppWebhookMediaRef;
};

type WhatsAppWebhookChange = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string };
    messages?: WhatsAppWebhookMessage[];
    event?: string;
    message_template_name?: string;
  };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    id?: string; // WhatsApp Business Account ID
    changes?: WhatsAppWebhookChange[];
  }>;
};

const TEMPLATE_STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "pending",
  PENDING_DELETION: "rejected",
  DISABLED: "rejected",
};

function extToFilename(filename: string | undefined, mimeType: string): string {
  if (filename) return filename;
  const ext = mimeType.split("/")[1] || "bin";
  return `archivo-${crypto.randomUUID()}.${ext}`;
}

/** Descarga y guarda en R2 la media de un mensaje entrante; regresa los campos a persistir. */
async function persistIncomingMedia({
  media,
  mediaType,
  accessToken,
  companyId,
}: {
  media: WhatsAppWebhookMediaRef;
  mediaType: "image" | "document";
  accessToken: string;
  companyId: string;
}): Promise<{ mediaKey: string | null; mediaFileName: string | null; body: string }> {
  if (!media.id) {
    return { mediaKey: null, mediaFileName: null, body: media.caption || "" };
  }

  try {
    const { url, mimeType } = await fetchWhatsAppMediaUrl({ mediaId: media.id, accessToken });
    const buffer = await downloadWhatsAppMedia({ url, accessToken });
    const filename = extToFilename(media.filename, mimeType);
    const mediaKey = `whatsapp-media/${companyId}/${crypto.randomUUID()}-${filename}`;
    await uploadBufferToStorage({ buffer, contentType: mimeType, key: mediaKey });
    return { mediaKey, mediaFileName: filename, body: media.caption || "" };
  } catch (err) {
    console.error("[whatsapp webhook] no se pudo descargar/guardar media entrante:", err);
    return { mediaKey: null, mediaFileName: media.filename || null, body: media.caption || "" };
  }
}

function handleVerify(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

/** Actualiza el estatus de la plantilla de la empresa cuando Meta la revisa. */
async function handleTemplateStatusUpdate(
  companyId: string,
  value: WhatsAppWebhookChange["value"],
  context: KeystoneContext,
) {
  const event = value?.event;
  if (!event) return;
  const status = TEMPLATE_STATUS_MAP[event];
  if (!status) return;

  await context.sudo().db.SaasCompany.updateOne({
    where: { id: companyId },
    data: { whatsappTemplateStatus: status },
  });
}

/** Procesa los mensajes de un payload ya verificado (firma OK, empresa ya resuelta). */
async function persistIncomingMessages(
  companyId: string,
  accessToken: string,
  messages: WhatsAppWebhookMessage[],
  context: KeystoneContext,
) {
  for (const msg of messages) {
    if (!msg.id) continue;

    const existing = await context.sudo().db.TechWhatsAppMessage.findOne({
      where: { waMessageId: msg.id },
    });
    if (existing) continue; // reintento de Meta, ya procesado

    const fromDigits = (msg.from || "").replace(/\D/g, "");
    let businessLeadId: string | null = null;
    let teamMemberId: string | null = null;
    let internalInitiatorId: string | null = null;

    if (fromDigits) {
      const lead = await findByPhone<{ id: string; phone?: string | null }>(
        fromDigits,
        async (fragment, take) =>
          (await context.sudo().query.TechBusinessLead.findMany({
            where: {
              saasCompany: { some: { id: { equals: companyId } } },
              phone: { contains: fragment },
            },
            query: "id phone",
            take,
          })) as Array<{ id: string; phone: string | null }>,
      );
      businessLeadId = lead?.id ?? null;

      // Si no es un lead, puede ser alguien del propio equipo respondiendo un chat interno.
      if (!businessLeadId) {
        const teammate = await findByPhone<{ id: string; phone?: string | null }>(
          fromDigits,
          async (fragment, take) =>
            (await context.sudo().query.User.findMany({
              where: {
                company: { id: { equals: companyId } },
                phone: { contains: fragment },
              },
              query: "id phone",
              take,
            })) as Array<{ id: string; phone: string | null }>,
        );
        teamMemberId = teammate?.id ?? null;

        // El hilo interno lo ven el teamMember y quien lo abrió: la respuesta hereda al
        // iniciador del último mensaje de ese hilo (ver whatsappMessageScopedWhere).
        if (teamMemberId) {
          const [latest] = (await context.sudo().query.TechWhatsAppMessage.findMany({
            where: {
              company: { id: { equals: companyId } },
              teamMember: { id: { equals: teamMemberId } },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
            query: "id internalInitiator { id }",
          })) as Array<{ internalInitiator: { id: string } | null }>;
          internalInitiatorId = latest?.internalInitiator?.id ?? null;
        }
      }
    }

    if (!businessLeadId && !teamMemberId) {
      // Solo los últimos 4 dígitos: es el número de un tercero, no va completo a los logs.
      console.warn(
        `[whatsapp webhook] mensaje entrante de un número que no es lead ni compañero (…${fromDigits.slice(-4)}): se guarda sin conversación`,
      );
    }

    let body = "";
    let mediaKey: string | null = null;
    let mediaFileName: string | null = null;
    let mediaType: "image" | "document" | null = null;

    if (msg.type === "text" && msg.text?.body) {
      body = msg.text.body;
    } else if (msg.type === "image" && msg.image) {
      mediaType = "image";
      const result = await persistIncomingMedia({
        media: msg.image,
        mediaType: "image",
        accessToken,
        companyId,
      });
      mediaKey = result.mediaKey;
      mediaFileName = result.mediaFileName;
      body = result.body;
    } else if (msg.type === "document" && msg.document) {
      mediaType = "document";
      const result = await persistIncomingMedia({
        media: msg.document,
        mediaType: "document",
        accessToken,
        companyId,
      });
      mediaKey = result.mediaKey;
      mediaFileName = result.mediaFileName;
      body = result.body;
    } else {
      body = msg.type ? `[${msg.type}, no soportado todavía]` : "";
    }

    await context.sudo().db.TechWhatsAppMessage.createOne({
      data: {
        company: { connect: { id: companyId } },
        ...(businessLeadId ? { businessLead: { connect: { id: businessLeadId } } } : {}),
        ...(teamMemberId ? { teamMember: { connect: { id: teamMemberId } } } : {}),
        ...(internalInitiatorId
          ? { internalInitiator: { connect: { id: internalInitiatorId } } }
          : {}),
        direction: "inbound",
        waMessageId: msg.id,
        fromPhone: msg.from || null,
        body,
        ...(mediaType ? { mediaType, mediaKey, mediaFileName } : {}),
        status: "received",
      },
    });
  }
}

async function handleIncoming(
  req: Request,
  res: Response,
  context: KeystoneContext,
) {
  // Se responde 200 de inmediato: Meta espera un ack rápido y reintenta agresivamente si no.
  res.sendStatus(200);

  try {
    const rawBody = req.body as Buffer;
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return; // body no es JSON, nada que hacer
    }

    // El WABA id siempre viene en entry[].id, tanto para mensajes como para eventos de plantilla.
    const wabaId = payload.entry?.[0]?.id;
    const change = payload.entry?.[0]?.changes?.[0];
    if (!wabaId || !change) return;

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { whatsappBusinessAccountId: wabaId },
      query: "id whatsappAppSecretEncrypted whatsappAccessTokenEncrypted",
    });
    if (!company?.whatsappAppSecretEncrypted) {
      console.warn(`[whatsapp webhook] WABA "${wabaId}" no está conectado a ninguna empresa`);
      return;
    }

    const appSecret = decrypt(company.whatsappAppSecretEncrypted);
    const signatureHeader = req.header("x-hub-signature-256");
    const validSignature = verifyWhatsAppSignature({ appSecret, rawBody, signatureHeader });

    if (!validSignature) {
      console.error(
        `[whatsapp webhook] firma inválida para la empresa "${company.id}", se descarta el payload`,
      );
      return;
    }

    if (change.field === "message_template_status_update") {
      await handleTemplateStatusUpdate(company.id, change.value, context);
      return;
    }

    const messages = change.value?.messages ?? [];
    if (messages.length === 0) return;

    const accessToken = company.whatsappAccessTokenEncrypted
      ? decrypt(company.whatsappAccessTokenEncrypted)
      : null;
    if (!accessToken) return;

    await persistIncomingMessages(company.id, accessToken, messages, context);
  } catch (err) {
    console.error("[whatsapp webhook] error procesando el payload:", err);
  }
}

export default function registerWhatsAppWebhook(
  app: Express,
  context: KeystoneContext,
) {
  app.get(WEBHOOK_PATH, handleVerify);
  app.post(
    WEBHOOK_PATH,
    express.raw({ type: "application/json" }),
    (req: Request, res: Response) => handleIncoming(req, res, context),
  );
}
