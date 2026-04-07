import { KeystoneContext } from "@keystone-6/core/types";

export type SaasSubscriptionLogInputFields = {
  planId: string;
  email: string;
  total: string;
  paymentMethodId: string;
  paymentType: string;
  notes?: string | null;
};

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

/**
 * Persist one row per checkout attempt. Swallows errors so billing never fails because of logging.
 */
export async function writeSaasSubscriptionLog(
  context: KeystoneContext,
  params: {
    startedAt: number;
    input: SaasSubscriptionLogInputFields;
    step: string;
    success: boolean;
    message: string;
    subscriptionId: string | null;
    paymentId: string | null;
    userId?: string | null;
    companyId?: string | null;
    planId?: string | null;
    createdSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const durationMs = Date.now() - params.startedAt;
    const responseSnapshot = {
      success: params.success,
      message: params.message,
      subscriptionId: params.subscriptionId,
      paymentId: params.paymentId,
      ...(params.extra ?? {}),
    };
    await context.sudo().query.SaasSubscriptionLog.createOne({
      data: {
        ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
        ...(params.companyId ? { company: { connect: { id: params.companyId } } } : {}),
        ...(params.planId ? { plan: { connect: { id: params.planId } } } : {}),
        ...(params.createdSubscriptionId
          ? { createdSubscription: { connect: { id: params.createdSubscriptionId } } }
          : {}),
        success: params.success,
        step: params.step,
        message: params.message,
        responseSnapshot,
        emailMasked: maskEmail(params.input.email),
        planIdRequested: params.input.planId,
        totalSubmitted: params.input.total,
        paymentMethodIdSubmitted: params.input.paymentMethodId,
        paymentTypeSubmitted: params.input.paymentType,
        durationMs,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      },
    });
  } catch {
    // ignore
  }
}
