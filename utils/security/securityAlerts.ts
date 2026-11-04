import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { getSessionUserId } from "../access/tenant";
import { logActivity } from "../activity/logActivity";
import { requestIp } from "../activity/requestMeta";
import { sendAdminSecurityAlertEmail } from "../helpers/sendgrid";
import { adminNotificationEmailsEnabled, notify } from "../notifications/notify";
import { ALERT_AFTER_EXCEEDED, ALERT_COOLDOWN_MS, RATE_LIMIT_RULE_LABELS } from "./constants";
import { createDeduper, createRateLimiter } from "./rateLimit";

/**
 * Qué pasa cuando alguien se pasa de un límite (fase 6.5):
 * 1. Queda `security.rate_limited` en Actividad (una vez por ventana y llave).
 * 2. Si la misma IP o persona se pasa varias veces en una hora, o la regla es de login, se avisa
 *    a los admins: campana de Operaciones y, con `ADMIN_NOTIFICATION_EMAILS=on`, correo. Con espera
 *    entre avisos para no saturar.
 * WhatsApp necesita una plantilla aprobada por Meta (ver docs/operaciones/decisiones.md).
 */

const exceededPerSubject = createRateLimiter({ limit: ALERT_AFTER_EXCEEDED - 1, windowMs: 60 * 60 * 1000 });
const alertCooldown = createDeduper(ALERT_COOLDOWN_MS);

export type ExceededInput = {
  rule: string;
  limit: number;
  windowMs: number;
  count: number;
  /** Solo la primera vez que esta llave se pasa en la ventana se registra en Actividad. */
  firstExceeded: boolean;
  /** Avisar a los admins desde la primera vez. */
  alertAlways?: boolean;
  /** Para login por correo: el correo enmascarado (nunca completo). */
  subjectLabel?: string | null;
};

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

export function maskedEmail(email: string | null | undefined): string | null {
  return email ? maskEmail(email.trim().toLowerCase()) : null;
}

export async function onRateLimitExceeded(context: KeystoneContext, input: ExceededInput): Promise<void> {
  try {
    const ip = requestIp(context.req);
    const userId = getSessionUserId(context.session as any);
    const label = RATE_LIMIT_RULE_LABELS[input.rule] ?? input.rule;
    const windowMinutes = Math.round(input.windowMs / 60_000);

    if (input.firstExceeded) {
      void logActivity(context, {
        type: ACTIVITY_EVENT.SECURITY_RATE_LIMITED,
        actorId: userId,
        summary: `Se pasó del límite: ${label}`,
        success: false,
        errorMessage: `${input.count} intentos en ${windowMinutes} min (límite ${input.limit})`,
        metadata: {
          rule: input.rule,
          limit: input.limit,
          windowMinutes,
          count: input.count,
          ...(input.subjectLabel ? { subject: input.subjectLabel } : {}),
        },
      });
    }

    if (!input.firstExceeded) return;
    const subject = userId ? `user:${userId}` : `ip:${ip ?? "?"}`;
    const repeated = !exceededPerSubject.hit(subject).ok;
    if (!input.alertAlways && !repeated) return;
    if (!alertCooldown(subject)) return;

    const who = userId ? "Una persona con sesión" : `La IP ${ip ?? "desconocida"}`;
    const title = `${label}: ${who} se pasó del límite`;
    void notify(context, {
      audience: "platform_admins",
      product: "saas",
      type: NOTIFICATION_TYPE.SECURITY_ALERT,
      title,
      body: `${input.count} intentos en ${windowMinutes} min. Revisa Operaciones → Seguridad.`,
      url: ip ? `/panel/clientes/admin?tab=actividad&ip=${encodeURIComponent(ip)}` : "/panel/clientes/admin?tab=seguridad",
      metadata: { rule: input.rule, ip, userId },
    });
    if (adminNotificationEmailsEnabled()) {
      void sendAdminSecurityAlertEmail({
        title,
        rows: [
          ["Regla", label],
          ["Intentos", `${input.count} en ${windowMinutes} min (límite ${input.limit})`],
          ["IP", ip ?? "—"],
          ["Persona", userId ?? "Sin sesión"],
          ...(input.subjectLabel ? ([["Cuenta", input.subjectLabel]] as Array<[string, string]>) : []),
        ],
      }).catch(() => undefined);
    }
  } catch (error) {
    console.warn("[security] no se pudo registrar el límite:", error instanceof Error ? error.message : error);
  }
}
