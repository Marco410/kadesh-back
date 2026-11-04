import { GraphQLError, Kind, type OperationDefinitionNode } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../access/tenant";
import { requestIp } from "../activity/requestMeta";
import {
  RATE_LIMITED_CODE,
  RATE_LIMIT_RULES,
  rateLimitedMessage,
  type RateLimitRule,
} from "./constants";
import { createRateLimiter, type RateLimiter } from "./rateLimit";
import { onRateLimitExceeded } from "./securityAlerts";

/**
 * Límites contra abuso en mutaciones (fase 6.5): registros, logins con Google, reportes,
 * comentarios, reseñas, contacto y veterinarias. Mira los campos raíz de la mutación, así cubre el
 * CRUD genérico de Keystone y las mutaciones propias. El login con contraseña tiene su propio
 * límite de intentos fallidos (`passwordLoginAudit.ts`).
 *
 * Se cuenta cada intento, salga bien o no. Admins de plataforma y la automatización de reportes
 * no tienen límite.
 */

const limiters = new Map<string, RateLimiter>(
  RATE_LIMIT_RULES.map((rule) => [rule.key, createRateLimiter({ limit: rule.limit, windowMs: rule.windowMs })]),
);

const rulesByField = new Map<string, RateLimitRule[]>();
for (const rule of RATE_LIMIT_RULES) {
  for (const field of rule.fields) {
    rulesByField.set(field, [...(rulesByField.get(field) ?? []), rule]);
  }
}

function rootFields(operation: OperationDefinitionNode): string[] {
  return operation.selectionSet.selections
    .filter((selection) => selection.kind === Kind.FIELD)
    .map((selection) => (selection as { name: { value: string } }).name.value);
}

/** La automatización de reportes (Facebook) entra con `PET_AUTOMATION_TOKEN`, sin sesión. */
function isAutomation(context: KeystoneContext): boolean {
  const expected = process.env.PET_AUTOMATION_TOKEN?.trim();
  if (!expected) return false;
  const header = context.req?.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return value?.replace(/^Bearer\s+/i, "").trim() === expected;
}

export const rateLimitPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext: {
        contextValue?: KeystoneContext;
        operation?: OperationDefinitionNode | null;
      }) {
        const operation = requestContext.operation;
        const context = requestContext.contextValue;
        if (!operation || operation.operation !== "mutation" || !context) return;
        if (isPlatformAdmin(context.session as any) || isAutomation(context)) return;

        const rules = [...new Set(rootFields(operation).flatMap((field) => rulesByField.get(field) ?? []))];
        if (rules.length === 0) return;
        const ip = requestIp(context.req) ?? "?";
        const userId = getSessionUserId(context.session as any);

        for (const rule of rules) {
          if (rule.anonymousOnly && userId) continue;
          // Sin sesión, una regla por persona cuenta por IP.
          const subject = rule.scope === "user" && userId ? `user:${userId}` : `ip:${ip}`;
          const result = limiters.get(rule.key)!.hit(`${rule.key}|${subject}`);
          if (result.ok) continue;
          await onRateLimitExceeded(context, {
            rule: rule.key,
            limit: rule.limit,
            windowMs: rule.windowMs,
            count: result.count,
            firstExceeded: result.firstExceeded,
            alertAlways: rule.alertAlways,
          });
          throw new GraphQLError(rateLimitedMessage(result.retryAfterSec), {
            extensions: {
              code: RATE_LIMITED_CODE,
              retryAfter: result.retryAfterSec,
              http: { status: 200 },
            },
          });
        }
      },
    };
  },
};
