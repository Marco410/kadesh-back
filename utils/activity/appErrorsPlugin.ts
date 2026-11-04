import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../models/ActivityEvent/constants";
import { getImpersonation } from "../../auth/impersonation";
import { createDeduper, createRateLimiter } from "../security/rateLimit";
import { logActivity } from "./logActivity";
import { requestIp } from "./requestMeta";

/**
 * Errores de la app (fases 5 y 6.1): cuando una consulta o un cambio falla, queda `app.error` en
 * Actividad con la operación, si era consulta o cambio, el mensaje, el código y los **nombres** de
 * las variables. `logActivity` agrega la app, la pantalla (headers del front), la IP y el
 * navegador. Así Kadesh ve los problemas antes de que la persona se queje.
 *
 * - Con sesión: el mismo error de la misma persona se registra una vez cada 10 minutos.
 * - Sin sesión (visitantes de Kadesh Pet): mismo deduplicado por IP y, además, un tope por IP por
 *   hora para que nadie pueda llenar la tabla a propósito.
 * - Nunca se guardan los valores de las variables (pueden traer datos personales).
 */

const REPEAT_MS = 10 * 60 * 1000;
const ANONYMOUS_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };
const MAX_VARIABLE_NAMES = 20;
const MAX_VARIABLE_DEPTH = 2;

/** Errores que no son fallas: bloqueos a propósito ("entrar como", IP bloqueada, límites). */
const IGNORED_CODES = new Set(["IMPERSONATION_READ_ONLY", "IP_BLOCKED", "RATE_LIMITED"]);

const shouldLog = createDeduper(REPEAT_MS);
const anonymousPerIp = createRateLimiter(ANONYMOUS_LIMIT);

type ErrorLike = { message?: string; extensions?: { code?: unknown } };

/** `{ data: { name, photos }, where: { id } }` → `data.name`, `data.photos`, `where.id`. */
export function variableNames(variables: unknown): string[] {
  const names: string[] = [];
  const walk = (value: unknown, prefix: string, depth: number) => {
    if (names.length >= MAX_VARIABLE_NAMES) return;
    if (!value || typeof value !== "object" || Array.isArray(value) || depth >= MAX_VARIABLE_DEPTH) {
      if (prefix) names.push(prefix);
      return;
    }
    const entries = Object.keys(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) {
      names.push(prefix);
      return;
    }
    for (const key of entries) {
      if (names.length >= MAX_VARIABLE_NAMES) return;
      walk((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key, depth + 1);
    }
  };
  walk(variables, "", 0);
  return names;
}

export const appErrorsPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors(requestContext: {
        contextValue?: KeystoneContext;
        errors?: readonly ErrorLike[];
        operationName?: string | null;
        operation?: { operation?: string } | null;
        request?: { variables?: Record<string, unknown> | null };
      }) {
        const context = requestContext.contextValue;
        if (!context) return;
        const session = context.session as
          | { itemId?: string; data?: { company?: { id?: string } | null } }
          | undefined;
        if (getImpersonation(session)) return;
        const errors = (requestContext.errors ?? []).filter(
          (error) => !IGNORED_CODES.has(String(error.extensions?.code ?? "")),
        );
        if (errors.length === 0) return;

        const userId = session?.itemId ?? null;
        const ip = requestIp(context.req);
        const companyId = session?.data?.company?.id ?? null;
        const operation = requestContext.operationName ?? "sin nombre";
        const message = errors[0].message ?? "Error desconocido";
        const who = userId ?? `ip:${ip ?? "?"}`;
        if (!shouldLog(`${companyId}|${who}|${operation}|${message}`)) return;
        if (!userId && !anonymousPerIp.hit(ip ?? "?").ok) return;

        void logActivity(context, {
          type: ACTIVITY_EVENT.APP_ERROR,
          actorId: userId,
          companyId,
          summary: `Falló ${operation}`,
          success: false,
          errorMessage: message,
          metadata: {
            operation,
            opType: requestContext.operation?.operation ?? null,
            code: String(errors[0].extensions?.code ?? "") || null,
            errors: errors.length,
            variables: variableNames(requestContext.request?.variables),
          },
        });
      },
    };
  },
};
