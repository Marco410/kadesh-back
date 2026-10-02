import crypto from "crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import { MetaDataDeletionStatus } from "../models/Saas/MetaDataDeletionRequest/constants";

const DATA_DELETION_PATH = "/webhooks/meta/data-deletion";
const STATUS_PATH = "/webhooks/meta/data-deletion/status";

type SignedPayload = {
  algorithm?: string;
  user_id?: string | number;
};

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

/**
 * Arma un `signed_request` de Meta: HMAC-SHA256 del payload ya en base64url,
 * con el App Secret. La firma se calcula sobre el string codificado, no sobre el JSON.
 */
export function signMetaRequest(secret: string, userId: string, issuedAt = Math.floor(Date.now() / 1000)): string {
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      algorithm: "HMAC-SHA256",
      issued_at: issuedAt,
      user_id: userId,
    }),
  );
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
  return `${base64UrlEncode(signature)}.${encodedPayload}`;
}

/** `null` si la firma no coincide, el payload no es JSON o `algorithm` no es HMAC-SHA256. */
export function verifyMetaSignedRequest(signedRequest: string, secret: string): SignedPayload | null {
  const dot = signedRequest.indexOf(".");
  if (dot <= 0 || dot === signedRequest.length - 1) return null;

  const encodedSig = signedRequest.slice(0, dot);
  const encodedPayload = signedRequest.slice(dot + 1);
  const received = base64UrlDecode(encodedSig);
  const expected = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
  if (received.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(received, expected)) return null;

  let payload: SignedPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as SignedPayload;
  } catch {
    return null;
  }
  if (payload.algorithm !== "HMAC-SHA256") return null;
  return payload;
}

function readSignedRequest(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as { signed_request?: unknown }).signed_request;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function statusPageUrl(confirmationCode: string): string | null {
  const base = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/eliminacion-de-datos?code=${encodeURIComponent(confirmationCode)}`;
}

/**
 * Borra o anonimiza lo ligado al app-scoped user id de Meta.
 *
 * TODO: cuando exista Facebook Login o Embedded Signup, borrar aquí los registros
 * que guarden este `userId`. Hoy ningún campo de `models/` persiste un id de
 * usuario de Meta/Facebook (sí hay tokens de Página, WABA y teléfonos de WhatsApp,
 * que no son este id). No hay filas que tocar.
 */
export async function deleteMetaUserData(userId: string, context: KeystoneContext): Promise<void> {
  void userId;
  void context;
}

async function handleDataDeletion(
  req: Request,
  res: Response,
  context: KeystoneContext,
): Promise<void> {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    console.warn("[meta data-deletion] falta META_APP_SECRET; el callback responde 503");
    res.sendStatus(503);
    return;
  }

  const signedRequest = readSignedRequest(req.body);
  const payload = signedRequest ? verifyMetaSignedRequest(signedRequest, secret) : null;
  if (!payload) {
    res.sendStatus(400);
    return;
  }

  const userId = payload.user_id == null ? "" : String(payload.user_id).trim();
  if (!userId) {
    res.sendStatus(400);
    return;
  }

  const confirmationCode = crypto.randomUUID().replace(/-/g, "");
  const url = statusPageUrl(confirmationCode);
  if (!url) {
    console.warn("[meta data-deletion] falta FRONTEND_URL; no se puede armar la URL de estado");
    res.sendStatus(503);
    return;
  }

  const created = (await context.sudo().query.MetaDataDeletionRequest.createOne({
    data: {
      metaUserId: userId,
      confirmationCode,
      status: MetaDataDeletionStatus.PENDING,
      requestedAt: new Date().toISOString(),
    },
    query: "id",
  })) as { id: string };

  try {
    await deleteMetaUserData(userId, context);
    await context.sudo().query.MetaDataDeletionRequest.updateOne({
      where: { id: created.id },
      data: {
        status: MetaDataDeletionStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[meta data-deletion] no se pudo completar el borrado", err);
    const message = err instanceof Error ? err.message : "error desconocido";
    await context
      .sudo()
      .query.MetaDataDeletionRequest.updateOne({
        where: { id: created.id },
        data: {
          status: MetaDataDeletionStatus.FAILED,
          notes: message.slice(0, 500),
        },
      })
      .catch((markErr: unknown) => {
        console.error("[meta data-deletion] no se pudo marcar failed", markErr);
      });
    res.sendStatus(500);
    return;
  }

  res.json({
    url,
    confirmation_code: confirmationCode,
  });
}

async function handleStatus(req: Request, res: Response, context: KeystoneContext): Promise<void> {
  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code) {
    res.sendStatus(400);
    return;
  }

  const [row] = (await context.sudo().query.MetaDataDeletionRequest.findMany({
    where: { confirmationCode: { equals: code } },
    query: "confirmationCode status requestedAt completedAt",
    take: 1,
  })) as Array<{
    confirmationCode?: string | null;
    status?: string | null;
    requestedAt?: string | null;
    completedAt?: string | null;
  }>;

  if (!row) {
    res.sendStatus(404);
    return;
  }

  res.json({
    code: row.confirmationCode,
    status: row.status,
    requestedAt: row.requestedAt ?? null,
    completedAt: row.completedAt ?? null,
  });
}

function run(
  handler: (req: Request, res: Response, context: KeystoneContext) => Promise<void>,
  req: Request,
  res: Response,
  context: KeystoneContext,
) {
  void handler(req, res, context).catch((err: unknown) => {
    console.error("[meta data-deletion] error inesperado", err);
    if (!res.headersSent) res.sendStatus(500);
  });
}

export default function registerMetaDataDeletionWebhook(app: Express, context: KeystoneContext) {
  app.post(
    DATA_DELETION_PATH,
    express.urlencoded({ extended: false }),
    (req: Request, res: Response) => {
      run(handleDataDeletion, req, res, context);
    },
  );
  app.get(STATUS_PATH, (req: Request, res: Response) => {
    run(handleStatus, req, res, context);
  });
}
