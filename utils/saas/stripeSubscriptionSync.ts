import type { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../models/Saas/SaasCompanySubscription/constants";
import {
  ACTIVITY_EVENT,
  type ActivitySource,
} from "../../models/ActivityEvent/constants";
import { logActivity } from "../activity/logActivity";

/**
 * Sincroniza una `SaasCompanySubscription` con lo que dice Stripe. Lo usan:
 * - `subscriptionStatus` (al abrir el panel; source `system`);
 * - el webhook de Stripe (`webhooks/stripe.ts`; source `webhook`).
 * Un solo lugar para no tener dos versiones de "qué pasa cuando cambia el estado".
 */

/** Map Stripe subscription status to our SUBSCRIPTION_STATUS */
export function stripeStatusToLocal(stripeStatus: string | null): string {
  if (!stripeStatus) return SUBSCRIPTION_STATUS.CANCELLED;
  const s = stripeStatus.toLowerCase();
  if (s === "active") return SUBSCRIPTION_STATUS.ACTIVE;
  if (s === "trialing") return SUBSCRIPTION_STATUS.TRIALING;
  if (s === "past_due") return SUBSCRIPTION_STATUS.PAST_DUE;
  if (s === "canceled" || s === "cancelled") return SUBSCRIPTION_STATUS.CANCELLED;
  if (s === "unpaid") return SUBSCRIPTION_STATUS.UNPAID;
  return s;
}

/** Unix (segundos) → YYYY-MM-DD, igual que guarda `createCompanySubscription`. */
export function unixToDay(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

const INACTIVE_STATUSES: ReadonlySet<string> = new Set([
  SUBSCRIPTION_STATUS.CANCELLED,
  SUBSCRIPTION_STATUS.UNPAID,
  SUBSCRIPTION_STATUS.PAST_DUE,
]);

const STATUS_LABELS: Record<string, string> = {
  [SUBSCRIPTION_STATUS.ACTIVE]: "activa",
  [SUBSCRIPTION_STATUS.TRIALING]: "en prueba",
  [SUBSCRIPTION_STATUS.PAST_DUE]: "con pago vencido",
  [SUBSCRIPTION_STATUS.UNPAID]: "sin pagar",
  [SUBSCRIPTION_STATUS.CANCELLED]: "cancelada",
};

export type LocalSubscription = {
  id: string;
  status: string | null;
  currentPeriodEnd: string | null;
  companyId?: string | null;
  planName?: string | null;
};

/**
 * Si el cliente dejó de pagar o canceló, las comisiones de referido pendientes de esa suscripción
 * ya no se van a pagar.
 */
async function cancelPendingCommissions(context: KeystoneContext, subscriptionId: string) {
  const pendingCommissions = await context.sudo().query.SaasReferralCommission.findMany({
    where: {
      subscription: { id: { equals: subscriptionId } },
      status: { equals: "PENDING" },
    },
    query: "id",
  });

  for (const commission of pendingCommissions as { id: string }[]) {
    await context.sudo().query.SaasReferralCommission.updateOne({
      where: { id: commission.id },
      data: {
        status: "CANCELLED",
        notes:
          "Comisión cancelada porque el cliente canceló o dejó de pagar la suscripción.",
      },
    });
  }
}

/**
 * Aplica estado y fin de periodo de Stripe a la suscripción local. Solo escribe si algo cambió.
 * Registra `billing.status_changed` (o `billing.cancelled`) cuando cambia el estado.
 */
export async function applySubscriptionState(
  context: KeystoneContext,
  sub: LocalSubscription,
  next: { status: string; currentPeriodEnd: string | null },
  meta: { source: ActivitySource; occurredAt?: Date; reason?: string },
): Promise<{ statusChanged: boolean; periodChanged: boolean }> {
  const statusChanged = next.status !== sub.status;
  const periodChanged = Boolean(next.currentPeriodEnd) && next.currentPeriodEnd !== sub.currentPeriodEnd;
  if (!statusChanged && !periodChanged) return { statusChanged, periodChanged };

  await context.sudo().query.SaasCompanySubscription.updateOne({
    where: { id: sub.id },
    data: {
      ...(statusChanged ? { status: next.status } : {}),
      ...(periodChanged ? { currentPeriodEnd: next.currentPeriodEnd } : {}),
    },
  });

  if (statusChanged && INACTIVE_STATUSES.has(next.status)) {
    await cancelPendingCommissions(context, sub.id);
  }

  if (statusChanged) {
    const cancelled = next.status === SUBSCRIPTION_STATUS.CANCELLED;
    const plan = sub.planName ? ` ${sub.planName}` : "";
    void logActivity(context, {
      type: cancelled ? ACTIVITY_EVENT.BILLING_CANCELLED : ACTIVITY_EVENT.BILLING_STATUS_CHANGED,
      actorId: null,
      companyId: sub.companyId ?? null,
      entityType: "SaasCompanySubscription",
      entityId: sub.id,
      summary: `La suscripción${plan} quedó ${STATUS_LABELS[next.status] ?? next.status}`,
      metadata: {
        from: sub.status,
        to: next.status,
        currentPeriodEnd: next.currentPeriodEnd,
        reason: meta.reason ?? null,
      },
      source: meta.source,
      occurredAt: meta.occurredAt,
    });
  }

  return { statusChanged, periodChanged };
}
