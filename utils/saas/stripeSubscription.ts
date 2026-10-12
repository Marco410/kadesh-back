const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

export type StripeSubscriptionInfo = {
  status: string | null;
  currentPeriodEnd: number | null; // Unix timestamp
  active: boolean; // true if status is "active" or "trialing"
  /**
   * No se pudo saber el estado (Stripe caído, límite de peticiones, llave faltante).
   * En ese caso NO se debe tocar la suscripción local: antes un error se leía como "cancelada".
   */
  unavailable: boolean;
};

const UNAVAILABLE: StripeSubscriptionInfo = {
  status: null,
  currentPeriodEnd: null,
  active: false,
  unavailable: true,
};

/** Fin del periodo: `current_period_end` (API vieja) o el de sus items (API 2025+). */
export function stripePeriodEnd(subscription: {
  current_period_end?: unknown;
  items?: { data?: Array<{ current_period_end?: unknown }> };
}): number | null {
  if (typeof subscription.current_period_end === "number") return subscription.current_period_end;
  const ends = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");
  return ends.length ? Math.max(...ends) : null;
}

/**
 * Fetches Stripe subscription by ID. Returns status, current_period_end and whether it's active/trialing.
 * Used by subscriptionStatus query to verify and sync local status with Stripe.
 * 404 = la suscripción ya no existe en Stripe (status null, `unavailable: false`).
 */
export async function getStripeSubscription(
  subscriptionId: string,
): Promise<StripeSubscriptionInfo> {
  if (!STRIPE_SECRET) return UNAVAILABLE;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          Accept: "application/json",
        },
      },
    );
    if (res.status === 404) {
      return { status: null, currentPeriodEnd: null, active: false, unavailable: false };
    }
    if (!res.ok) return UNAVAILABLE;
    const data = (await res.json()) as {
      status?: string;
      current_period_end?: number;
      items?: { data?: Array<{ current_period_end?: number }> };
    };
    const status = data.status ?? null;
    const active =
      status === "active" || status === "trialing";
    return {
      status,
      currentPeriodEnd: stripePeriodEnd(data),
      active,
      unavailable: false,
    };
  } catch {
    return UNAVAILABLE;
  }
}
