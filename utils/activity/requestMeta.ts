import type { IncomingMessage } from "http";

const MAX_IP = 64;
const MAX_USER_AGENT = 300;

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * IP de la petición. Detrás del proxy del hosting la real viene primera en `x-forwarded-for`.
 * Es un dato informativo para auditoría, no una prueba: sin proxy, el cliente puede mandar ese header.
 */
export function requestIp(req?: IncomingMessage | null): string | null {
  if (!req) return null;
  const forwarded = firstHeader(req.headers?.["x-forwarded-for"])?.split(",")[0]?.trim();
  const ip = forwarded || req.socket?.remoteAddress || "";
  const clean = ip.replace(/^::ffff:/, "").slice(0, MAX_IP);
  return clean || null;
}

export function requestUserAgent(req?: IncomingMessage | null): string | null {
  const ua = firstHeader(req?.headers?.["user-agent"])?.trim();
  return ua ? ua.slice(0, MAX_USER_AGENT) : null;
}
