import type { KeystoneContext } from "@keystone-6/core/types";
import {
  ACTIVITY_SOURCE,
  categoryForType,
  type ActivitySource,
} from "../../models/ActivityEvent/constants";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
} from "../access/tenant";
import { requestIp, requestUserAgent } from "./requestMeta";

export type LogActivityInput = {
  type: string;
  summary: string;
  /** Por defecto, la persona de la sesión. `null` explícito = sin actor (sistema, webhook). */
  actorId?: string | null;
  /** Por defecto, la empresa de la sesión. */
  companyId?: string | null;
  workspaceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Por defecto se deduce de la sesión (ver `resolveSource`). */
  source?: ActivitySource;
  success?: boolean;
  errorMessage?: string | null;
  /** Para webhooks: la hora del proveedor. Por defecto, ahora. */
  occurredAt?: Date;
};

const SENSITIVE_KEY =
  /pass(word)?|secret|token|api[-_]?key|authorization|cookie|prompt|response|body|message_?text|card_?number|cvc|clabe/i;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_DEPTH = 4;
const MAX_METADATA_BYTES = 8_000;
const MAX_SUMMARY = 500;
const MAX_ERROR = 1_000;

function scrubValue(value: unknown, depth: number): unknown {
  if (value == null) return null;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((v) => scrubValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[oculto]" : scrubValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Limpia la metadata antes de guardarla: quita llaves sensibles (contraseñas, tokens, prompts,
 * cuerpos), recorta textos y arreglos, y la descarta si sigue siendo enorme.
 */
export function scrubMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const clean = scrubValue(metadata, 0) as Record<string, unknown>;
  try {
    if (JSON.stringify(clean).length > MAX_METADATA_BYTES) {
      return { truncated: true, keys: Object.keys(clean).slice(0, MAX_ARRAY) };
    }
  } catch {
    return null;
  }
  return clean;
}

/**
 * `admin` si un admin de Kadesh toca datos de otra empresa; `web` si es una persona desde el panel;
 * `system` si no hay sesión.
 */
function resolveSource(context: KeystoneContext, companyId: string | null): ActivitySource {
  const session = context.session as Parameters<typeof getSessionUserId>[0];
  if (!getSessionUserId(session)) return ACTIVITY_SOURCE.SYSTEM;
  if (isPlatformAdmin(session) && companyId && companyId !== getSessionCompanyId(session)) {
    return ACTIVITY_SOURCE.ADMIN;
  }
  return ACTIVITY_SOURCE.WEB;
}

/** Un aviso por minuto basta (p. ej. si se desplegó sin migrar y la tabla no existe). */
const WARN_EVERY_MS = 60_000;
let lastWarnAt = 0;

function warnOnce(type: string, error: unknown) {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  console.warn(
    `[activity] no se pudo registrar ${type}:`,
    error instanceof Error ? error.message : error,
  );
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Guarda un evento en `ActivityEvent`. Nunca lanza: un fallo del registro jamás rompe la operación
 * del usuario. Escribe con Prisma (sudo) para no disparar hooks ni access.
 * Se puede llamar sin `await` (no hay transacciones en el back, la escritura no depende de la petición).
 */
export async function logActivity(
  context: KeystoneContext,
  input: LogActivityInput,
): Promise<void> {
  try {
    const session = context.session as Parameters<typeof getSessionUserId>[0];
    const actorId = input.actorId === undefined ? getSessionUserId(session) : input.actorId;
    const companyId =
      input.companyId === undefined ? getSessionCompanyId(session) : input.companyId;
    const prisma = context.sudo().prisma as any;
    if (!prisma?.activityEvent) return;

    await prisma.activityEvent.create({
      data: {
        type: input.type,
        category: categoryForType(input.type),
        actorId: actorId || null,
        companyId: companyId || null,
        workspaceId: input.workspaceId || null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: truncate(input.summary, MAX_SUMMARY) ?? "",
        metadata: scrubMetadata(input.metadata) ?? undefined,
        source: input.source ?? resolveSource(context, companyId || null),
        success: input.success ?? true,
        errorMessage: truncate(input.errorMessage, MAX_ERROR),
        ip: requestIp(context.req),
        userAgent: requestUserAgent(context.req),
        ...(input.occurredAt ? { createdAt: input.occurredAt } : {}),
      },
    });
  } catch (error) {
    warnOnce(input.type, error);
  }
}
