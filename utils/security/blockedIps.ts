import type { Express, NextFunction, Request, Response } from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import { requestIp } from "../activity/requestMeta";
import { IP_BLOCKED_CODE, IP_BLOCKED_MESSAGE } from "./constants";

/**
 * Bloqueo por IP (fase 6.5). Un middleware de Express sobre `/api/graphql` responde `IP_BLOCKED`
 * antes de la sesión y de Apollo, así cubre visitantes sin sesión y el Admin de Keystone.
 *
 * La lista vive en `BlockedIp` y se cachea en memoria: se refresca cada minuto y al bloquear o
 * desbloquear desde Operaciones. Si la tabla aún no existe (antes de migrar), no bloquea nada.
 */

const REFRESH_MS = 60 * 1000;
const GRAPHQL_PATH = "/api/graphql";

let blocked = new Map<string, number | null>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load(prisma: any): Promise<void> {
  if (!prisma?.blockedIp) return;
  try {
    const rows: Array<{ ip: string; expiresAt: Date | null }> = await prisma.blockedIp.findMany({
      select: { ip: true, expiresAt: true },
    });
    const next = new Map<string, number | null>();
    for (const row of rows) {
      next.set(row.ip, row.expiresAt ? new Date(row.expiresAt).getTime() : null);
    }
    blocked = next;
    loadedAt = Date.now();
  } catch (error) {
    loadedAt = Date.now();
    console.warn("[security] no se pudo leer BlockedIp:", error instanceof Error ? error.message : error);
  }
}

/** Vuelve a leer la lista (después de bloquear o desbloquear). */
export async function refreshBlockedIps(prisma: any): Promise<void> {
  loading = load(prisma).finally(() => {
    loading = null;
  });
  await loading;
}

async function ensureFresh(prisma: any) {
  if (Date.now() - loadedAt < REFRESH_MS) return;
  if (!loading) {
    loading = load(prisma).finally(() => {
      loading = null;
    });
  }
  await loading;
}

export function isIpBlocked(ip: string | null | undefined, now = Date.now()): boolean {
  if (!ip) return false;
  if (!blocked.has(ip)) return false;
  const until = blocked.get(ip);
  return until == null || until > now;
}

export function registerIpBlocklist(app: Express, context: KeystoneContext) {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  app.use(GRAPHQL_PATH, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureFresh(prisma);
      if (!isIpBlocked(requestIp(req))) return next();
      res.status(200).json({
        errors: [{ message: IP_BLOCKED_MESSAGE, extensions: { code: IP_BLOCKED_CODE } }],
      });
    } catch {
      next();
    }
  });
}
