import crypto from "crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import { commentTask, setTaskStatus } from "../utils/intregrations/clickup";
import { scheduleApprovedClickUpTask } from "../utils/clickup/schedulePost";

const WEBHOOK_PATH = "/webhooks/clickup";

type StatusValue = { status?: string | null };

type HistoryItem = {
  field?: string | null;
  after?: StatusValue | null;
};

type ClickUpWebhookPayload = {
  event?: string;
  task_id?: string;
  history_items?: HistoryItem[];
};

function rawBodyOf(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return Buffer.alloc(0);
}

/** HMAC-SHA256 hex del body crudo. Longitudes distintas no se comparan (timingSafeEqual lanza). */
function verifyClickUpSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.trim().toLowerCase();
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function isApprovedStatusUpdate(payload: ClickUpWebhookPayload): boolean {
  if (payload.event !== "taskStatusUpdated") return false;
  return (payload.history_items ?? []).some((item) => {
    if (item.field !== "status") return false;
    const status = item.after?.status;
    return typeof status === "string" && status.toLowerCase() === "aprobado";
  });
}

function commentForError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  const text = message.replace(/^\[clickup\]\s*/, "").trim();
  if (!text) return "No se pudo programar el post.";
  if (text.length <= 500) return text;
  return `${text.slice(0, 500)}…`;
}

async function handleClickUpWebhook(
  req: Request,
  res: Response,
  context: KeystoneContext,
): Promise<void> {
  try {
    await routeClickUpWebhook(req, res, context);
  } catch (err) {
    console.error("[clickup] error inesperado", err);
    if (!res.headersSent) res.sendStatus(500);
  }
}

async function routeClickUpWebhook(
  req: Request,
  res: Response,
  context: KeystoneContext,
): Promise<void> {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET?.trim();
  const rawBody = rawBodyOf(req);
  if (!secret || !verifyClickUpSignature(rawBody, req.header("x-signature"), secret)) {
    console.warn(
      `[clickup] firma rechazada (${secret ? "no coincide" : "falta CLICKUP_WEBHOOK_SECRET"})`,
    );
    res.sendStatus(401);
    return;
  }

  let payload: ClickUpWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as ClickUpWebhookPayload;
  } catch {
    console.warn("[clickup] body no es JSON");
    res.sendStatus(200);
    return;
  }

  if (!isApprovedStatusUpdate(payload)) {
    res.sendStatus(200);
    return;
  }

  const taskId = payload.task_id?.trim();
  if (!taskId) {
    console.warn("[clickup] taskStatusUpdated sin task_id");
    res.sendStatus(200);
    return;
  }

  // ClickUp reintenta si tardamos. El post se arma después de este 200.
  res.sendStatus(200);

  try {
    await scheduleApprovedClickUpTask(taskId, context);
  } catch (err) {
    console.error("[clickup]", err);
    try {
      await setTaskStatus(taskId, "error");
      await commentTask(taskId, commentForError(err));
    } catch (markErr) {
      console.error("[clickup] no se pudo marcar la tarea como error", markErr);
    }
  }
}

export default function registerClickUpWebhook(app: Express, context: KeystoneContext) {
  app.post(
    WEBHOOK_PATH,
    express.raw({ type: "application/json" }),
    (req: Request, res: Response) => {
      void handleClickUpWebhook(req, res, context);
    },
  );
}
