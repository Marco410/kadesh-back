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
import { mapTemplateStatus } from "../utils/whatsapp/templateStatus";

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
    /** Nombre de perfil de WhatsApp de quien escribe (no es el del CRM). */
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    messages?: WhatsAppWebhookMessage[];
    /** Acuses de entrega/lectura de lo que mandamos. No se persisten; sólo se registran. */
    statuses?: Array<{ id?: string; status?: string }>;
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
    console.log("[whatsapp webhook] verificación OK (Meta dio de alta la Callback URL)");
    res.status(200).send(challenge);
    return;
  }

  // Meta muestra un error genérico al verificar; el motivo real sólo se ve aquí.
  console.warn(
    `[whatsapp webhook] verificación RECHAZADA: mode=${String(mode)}, ${
      !expected
        ? "falta WHATSAPP_WEBHOOK_VERIFY_TOKEN en el servidor"
        : "el verify token no coincide con el que pegaron en Meta"
    }`,
  );
  res.sendStatus(403);
}

/** Actualiza el estatus de la plantilla de la empresa cuando Meta la revisa. */
async function handleTemplateStatusUpdate(
  companyId: string,
  value: WhatsAppWebhookChange["value"],
  context: KeystoneContext,
) {
  const event = value?.event;
  if (!event) return;
  const status = mapTemplateStatus(event);
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
  contacts: NonNullable<WhatsAppWebhookChange["value"]>["contacts"],
  context: KeystoneContext,
) {
  for (const msg of messages) {
    if (!msg.id) continue;

    const existing = await context.sudo().db.TechWhatsAppMessage.findOne({
      where: { waMessageId: msg.id },
    });
    if (existing) continue; // reintento de Meta, ya procesado

    const fromDigits = (msg.from || "").replace(/\D/g, "");
    // Sirve para poner nombre a un número que aún no es cliente (si no, solo se vería el teléfono).
    const profileName =
      (contacts ?? []).find((c) => c.wa_id === msg.from)?.profile?.name?.trim() ||
      contacts?.[0]?.profile?.name?.trim() ||
      null;
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
        ...(profileName ? { senderLabel: profileName } : {}),
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

    // Traza de entrada: sin esto, "no me llegan los mensajes" es indistinguible entre "Meta
    // nunca llamó" (App en modo Desarrollo, webhook sin dar de alta, campo `messages` sin
    // suscribir) y "llamó pero lo descartamos". Es una línea por evento, no por mensaje.
    console.log(
      `[whatsapp webhook] POST recibido (${rawBody?.length ?? 0} bytes, firma: ${
        req.header("x-hub-signature-256") ? "presente" : "AUSENTE"
      })`,
    );

    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      console.warn("[whatsapp webhook] descartado: el body no es JSON");
      return;
    }

    // El WABA id siempre viene en entry[].id, tanto para mensajes como para eventos de plantilla.
    const wabaId = payload.entry?.[0]?.id;
    const change = payload.entry?.[0]?.changes?.[0];
    if (!wabaId || !change) {
      console.warn(
        `[whatsapp webhook] descartado: payload sin entry/changes utilizables (wabaId: ${
          wabaId ?? "—"
        })`,
      );
      return;
    }

    console.log(
      `[whatsapp webhook] wabaId=${wabaId} field=${change.field ?? "—"} mensajes=${
        change.value?.messages?.length ?? 0
      } statuses=${change.value?.statuses?.length ?? 0}`,
    );

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { whatsappBusinessAccountId: wabaId },
      query: "id whatsappAppSecretEncrypted whatsappAccessTokenEncrypted",
    });
    if (!company?.whatsappAppSecretEncrypted) {
      console.warn(
        `[whatsapp webhook] descartado: el WABA "${wabaId}" no está conectado a ninguna empresa` +
          (company ? " (la empresa existe pero no tiene App Secret guardado)" : ""),
      );
      return;
    }

    const appSecret = decrypt(company.whatsappAppSecretEncrypted);
    const signatureHeader = req.header("x-hub-signature-256");
    const validSignature = verifyWhatsAppSignature({ appSecret, rawBody, signatureHeader });

    if (!validSignature) {
      console.error(
        `[whatsapp webhook] descartado: firma inválida para la empresa "${company.id}". ` +
          "El App Secret guardado no es el de la App de Meta que manda este webhook.",
      );
      return;
    }

    if (change.field === "message_template_status_update") {
      console.log(
        `[whatsapp webhook] plantilla "${change.value?.message_template_name ?? "—"}" → ${
          change.value?.event ?? "—"
        } (empresa ${company.id})`,
      );
      await handleTemplateStatusUpdate(company.id, change.value, context);
      return;
    }

    const messages = change.value?.messages ?? [];
    if (messages.length === 0) {
      // Lo normal aquí son los `statuses` (sent/delivered/read) de lo que mandamos nosotros.
      console.log(
        `[whatsapp webhook] sin mensajes entrantes que guardar (field=${change.field ?? "—"})`,
      );
      return;
    }

    const accessToken = company.whatsappAccessTokenEncrypted
      ? decrypt(company.whatsappAccessTokenEncrypted)
      : null;
    if (!accessToken) {
      console.error(
        `[whatsapp webhook] descartado: la empresa "${company.id}" no tiene access token guardado`,
      );
      return;
    }

    console.log(
      `[whatsapp webhook] guardando ${messages.length} mensaje(s) entrante(s) de la empresa ${company.id}`,
    );

    // Señal de salud: ya llegó un mensaje real (firma válida) por este webhook.
    await context
      .sudo()
      .prisma.saasCompany.update({
        where: { id: String(company.id) },
        data: { whatsappLastWebhookAt: new Date() },
      })
      .catch((e: unknown) => console.warn("[whatsapp webhook] no se pudo guardar lastWebhookAt", e));

    await persistIncomingMessages(company.id, accessToken, messages, change.value?.contacts, context);
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
