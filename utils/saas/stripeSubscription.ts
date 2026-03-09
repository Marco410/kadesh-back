const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

export type StripeSubscriptionInfo = {
  status: string | null;
  currentPeriodEnd: number | null; // Unix timestamp
  active: boolean; // true if status is "active" or "trialing"
};

/**
 * Fetches Stripe subscription by ID. Returns status, current_period_end and whether it's active/trialing.
 * Used by subscriptionStatus query to verify and sync local status with Stripe.
 */
export async function getStripeSubscription(
  subscriptionId: string,
): Promise<StripeSubscriptionInfo> {
  if (!STRIPE_SECRET) {
    return { status: null, currentPeriodEnd: null, active: false };
  }
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
    if (!res.ok) return { status: null, currentPeriodEnd: null, active: false };
    const data = (await res.json()) as {
      status?: string;
      current_period_end?: number;
    };
    const status = data.status ?? null;
    const active =
      status === "active" || status === "trialing";
    return {
      status,
      currentPeriodEnd: data.current_period_end ?? null,
      active,
    };
  } catch {
    return { status: null, currentPeriodEnd: null, active: false };
  }
}
