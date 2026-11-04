import type { IncomingMessage } from "http";
import {
  ACTIVITY_APP,
  ACTIVITY_APP_VALUES,
  type ActivityApp,
} from "../../models/ActivityEvent/constants";

const MAX_IP = 64;
const MAX_USER_AGENT = 300;
const MAX_PAGE = 200;
const MAX_PATH = 160;

/** Parámetros de la URL que sí dicen en qué pantalla estaba (sin tokens, correos ni búsquedas). */
const PAGE_QUERY_KEYS = new Set(["tab", "vista", "clinic", "pet"]);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function header(req: IncomingMessage | null | undefined, name: string): string | undefined {
  return firstHeader(req?.headers?.[name])?.trim() || undefined;
}

function cleanIp(value: string | undefined): string | null {
  const clean = (value ?? "").trim().replace(/^::ffff:/, "").slice(0, MAX_IP);
  return clean || null;
}

/**
 * IP de la petición. Por defecto, la primera de `x-forwarded-for` (la que pone el proxy del
 * hosting). Es un dato informativo, no una prueba: si el proxy agrega en lugar de reemplazar, el
 * cliente puede mandar la suya primero.
 *
 * `CLIENT_IP_HEADER` cambia la fuente cuando se confirme cómo la pasa Railway:
 * - sin valor o `x-forwarded-for`: primera de `x-forwarded-for`;
 * - `x-forwarded-for-last`: la última (la que agregó el proxy);
 * - otro nombre (`x-real-ip`, `x-envoy-external-address`…): ese header.
 * Los límites y el bloqueo por IP dependen de que esta IP no se pueda falsificar.
 */
export function requestIp(req?: IncomingMessage | null): string | null {
  if (!req) return null;
  const source = (process.env.CLIENT_IP_HEADER ?? "").trim().toLowerCase();
  const forwarded = header(req, "x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let ip: string | undefined;
  if (!source || source === "x-forwarded-for") ip = forwarded?.[0];
  else if (source === "x-forwarded-for-last") ip = forwarded?.[forwarded.length - 1];
  else ip = header(req, source);

  return cleanIp(ip || req.socket?.remoteAddress);
}

export function requestUserAgent(req?: IncomingMessage | null): string | null {
  const ua = header(req, "user-agent");
  return ua ? ua.slice(0, MAX_USER_AGENT) : null;
}

const ORIGIN_APPS: Array<[RegExp, ActivityApp]> = [
  [/^https?:\/\/pet\.kadesh\.com\.mx$/i, ACTIVITY_APP.PET_WEB],
  [/^https?:\/\/(www\.)?kadesh\.com\.mx$/i, ACTIVITY_APP.BUSINESS_WEB],
];

/** App que hizo la petición: header `x-kadesh-app` (lista cerrada) o, si no viene, el `origin`. */
export function requestApp(req?: IncomingMessage | null): ActivityApp | null {
  const declared = header(req, "x-kadesh-app")?.toLowerCase();
  if (declared && ACTIVITY_APP_VALUES.has(declared)) return declared as ActivityApp;
  const origin = header(req, "origin");
  if (!origin) return null;
  for (const [pattern, app] of ORIGIN_APPS) {
    if (pattern.test(origin)) return app;
  }
  return null;
}

export function cleanApp(value: unknown): ActivityApp | null {
  if (typeof value !== "string") return null;
  const app = value.trim().toLowerCase();
  return ACTIVITY_APP_VALUES.has(app) ? (app as ActivityApp) : null;
}

/**
 * Pantalla en la que estaba la persona: ruta de la app (`/animales/nuevo`) más solo los parámetros
 * que identifican la vista (`?tab=pets`). Descarta todo lo demás (tokens, correos, búsquedas).
 */
export function cleanPage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, "http://kadesh.local");
  } catch {
    return null;
  }
  let pathname = url.pathname;
  try {
    // Legible en Operaciones: `/veterinarias/clínica` y no `/veterinarias/cl%C3%ADnica`.
    pathname = decodeURIComponent(pathname);
  } catch {
    // Se queda codificada.
  }
  const path = pathname.slice(0, MAX_PATH);
  const params = new URLSearchParams();
  for (const [key, val] of url.searchParams) {
    if (PAGE_QUERY_KEYS.has(key) && val) params.append(key, val.slice(0, 60));
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`.slice(0, MAX_PAGE);
}

/** Pantalla que manda el front en el header `x-kadesh-page`. */
export function requestPage(req?: IncomingMessage | null): string | null {
  const raw = header(req, "x-kadesh-page");
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Se queda como vino.
  }
  return cleanPage(decoded);
}
