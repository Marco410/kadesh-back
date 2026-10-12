import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../models/ActivityEvent/constants";
import { getImpersonation } from "../../auth/impersonation";
import { logActivity } from "./logActivity";

/**
 * Errores por empresa (fase 5): cuando una consulta o un cambio de alguien con sesión falla, queda
 * `app.error` en Actividad con el nombre de la operación y el mensaje del error. Así Kadesh ve los
 * problemas antes de que el cliente se queje.
 *
 * Nunca se guardan las variables de la petición (pueden traer datos personales). El mismo error
 * de la misma empresa se registra una vez cada 10 minutos para no llenar la tabla.
 */

const REPEAT_MS = 10 * 60 * 1000;
/** Errores que no son fallas: el modo "entrar como" bloquea cambios a propósito. */
const IGNORED_CODES = new Set(["IMPERSONATION_READ_ONLY"]);
const recent = new Map<string, number>();

function shouldLog(key: string, now: number): boolean {
  for (const [k, at] of recent) {
    if (now - at > REPEAT_MS) recent.delete(k);
  }
  if (recent.has(key)) return false;
  recent.set(key, now);
  return true;
}

type ErrorLike = { message?: string; extensions?: { code?: unknown } };

export const appErrorsPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors(requestContext: {
        contextValue?: KeystoneContext;
        errors?: readonly ErrorLike[];
        operationName?: string | null;
        operation?: { operation?: string } | null;
      }) {
        const context = requestContext.contextValue;
        const session = context?.session as
          | { itemId?: string; data?: { company?: { id?: string } | null } }
          | undefined;
        if (!context || !session?.itemId || getImpersonation(session)) return;
        const errors = (requestContext.errors ?? []).filter(
          (error) => !IGNORED_CODES.has(String(error.extensions?.code ?? "")),
        );
        if (errors.length === 0) return;

        const companyId = session.data?.company?.id ?? null;
        const operation = requestContext.operationName ?? "sin nombre";
        const message = errors[0].message ?? "Error desconocido";
        if (!shouldLog(`${companyId}|${session.itemId}|${operation}|${message}`, Date.now())) return;

        void logActivity(context, {
          type: ACTIVITY_EVENT.APP_ERROR,
          companyId,
          summary: `Falló ${operation}`,
          success: false,
          errorMessage: message,
          metadata: {
            operation,
            kind: requestContext.operation?.operation ?? null,
            code: String(errors[0].extensions?.code ?? "") || null,
            errors: errors.length,
          },
        });
      },
    };
  },
};
