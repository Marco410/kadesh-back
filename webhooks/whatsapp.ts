import type { Express, Request, Response } from "express";
import express from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../utils/helpers/encryption";
import { verifyWhatsAppSignature } from "../utils/intregrations/whatsapp";

const WEBHOOK_PATH = "/webhooks/whatsapp";

type WhatsAppWebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WhatsAppWebhookMessage[];
      };
    }>;
  }>;
};

/** Últimos 10 dígitos: heurística para matchear contra `TechBusinessLead.phone` (texto libre, sin
 * normalizar), sin importar si el lead lo tiene guardado con o sin lada/espacios/guiones. */
function last10Digits(digits: string): string {
  return digits.slice(-10);
}

function extractMessageBody(msg: WhatsAppWebhookMessage): string {
  if (msg.type === "text" && msg.text?.body) return msg.text.body;
  return msg.type ? `[${msg.type}, no soportado todavía]` : "";
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

/** Procesa los mensajes de un payload ya verificado (firma OK, empresa ya resuelta). */
async function persistIncomingMessages(
  companyId: string,
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

    if (fromDigits) {
      const candidates = await context.sudo().query.TechBusinessLead.findMany({
        where: {
          saasCompany: { some: { id: { equals: companyId } } },
          phone: { contains: last10Digits(fromDigits) },
        },
        query: "id",
        take: 1,
      });
      businessLeadId = candidates[0]?.id ?? null;
    }

    await context.sudo().db.TechWhatsAppMessage.createOne({
      data: {
        company: { connect: { id: companyId } },
        ...(businessLeadId ? { businessLead: { connect: { id: businessLeadId } } } : {}),
        direction: "inbound",
        waMessageId: msg.id,
        fromPhone: msg.from || null,
        body: extractMessageBody(msg),
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

    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const messages = value?.messages ?? [];
    if (!phoneNumberId || messages.length === 0) return;

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { whatsappPhoneNumberId: phoneNumberId },
      query: "id whatsappAppSecretEncrypted",
    });
    if (!company?.whatsappAppSecretEncrypted) {
      console.warn(
        `[whatsapp webhook] phone_number_id "${phoneNumberId}" no está conectado a ninguna empresa`,
      );
      return;
    }

    const appSecret = decrypt(company.whatsappAppSecretEncrypted);
    const signatureHeader = req.header("x-hub-signature-256");
    const validSignature = verifyWhatsAppSignature({
      appSecret,
      rawBody,
      signatureHeader,
    });

    if (!validSignature) {
      console.error(
        `[whatsapp webhook] firma inválida para la empresa "${company.id}", se descarta el payload`,
      );
      return;
    }

    await persistIncomingMessages(company.id, messages, context);
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
