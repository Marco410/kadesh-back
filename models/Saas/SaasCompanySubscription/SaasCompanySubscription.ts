import { graphql, list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  calendarDay,
  select,
  relationship,
  timestamp,
  virtual,
  json,
} from "@keystone-6/core/fields";
import { saasCompanySubscriptionAccess } from "./SaasCompanySubscription.access";
import { SUBSCRIPTION_STATUS_OPTIONS } from "./constants";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

/** Fetches Stripe Subscription and returns whether it is active/trialing. Uses STRIPE_SECRET_KEY. */
async function checkStripeSubscriptionActive(
  subscriptionId: string,
): Promise<boolean> {
  if (!STRIPE_SECRET) return false;
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
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "active" || data.status === "trialing";
  } catch {
    return false;
  }
}

/** Fetches Stripe Price and returns whether it is active. Uses STRIPE_SECRET_KEY. */
async function checkStripePriceActive(priceId: string): Promise<boolean> {
  if (!STRIPE_SECRET) return false;
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { active?: boolean };
    return data.active === true;
  } catch {
    return false;
  }
}

export default list({
  access: saasCompanySubscriptionAccess,
  ui: {
    listView: {
      initialColumns: [
        "company",
        "planName",
        "planCost",
        "planLeadLimit",
        "planFeatures",
        "status",
        "activeInStripe",
        "activatedAt",
        "stripeSubscriptionId",
      ],
    },
  },
  fields: {
    /** Company that owns this subscription */
    company: relationship({
      ref: "SaasCompany.subscriptions",
      many: false,
      ui: { description: "Company that paid for this subscription" },
    }),

    /** Snapshot: plan name at time of contract (no relation to SaasPlan) */
    planName: text({
      ui: { description: "Plan name as contracted (snapshot)" },
    }),
    /** Snapshot: plan cost at time of contract */
    planCost: float({
      ui: { description: "Plan cost as contracted (snapshot)" },
    }),
    /** Snapshot: billing frequency (weekly, monthly, annual) */
    planFrequency: text({
      ui: { description: "Plan frequency as contracted (snapshot)" },
    }),
    /** Snapshot: lead limit at time of contract */
    planLeadLimit: integer({
      ui: { description: "Lead limit as contracted (snapshot)" },
    }),
    /** Snapshot: Stripe Price ID at time of contract */
    planStripePriceId: text({
      ui: { description: "Stripe Price ID as contracted (snapshot)" },
    }),
    /** Snapshot: currency at time of contract */
    planCurrency: text({
      ui: { description: "Currency as contracted (snapshot, e.g. mxn)" },
    }),
    planFeatures: json({
      ui: {
        description:
          "Features included in this subscription (snapshot from plan at contract time). Check subscription.planFeatures for enabled features.",
      },
    }),
    activeInStripe: virtual({
      field: graphql.field({
        type: graphql.Boolean,
        async resolve(
          item: {
            id: string;
            planStripePriceId?: string | null;
            stripeSubscriptionId?: string | null;
          },
          _args,
          context,
        ) {
          let subId = item.stripeSubscriptionId;
          let priceId = item.planStripePriceId;
          if (item.id && (subId == null || priceId == null)) {
            const sub = (await context
              .sudo()
              .query.SaasCompanySubscription.findOne({
                where: { id: item.id },
                query: "stripeSubscriptionId planStripePriceId",
              })) as {
              stripeSubscriptionId?: string | null;
              planStripePriceId?: string | null;
            } | null;
            subId = sub?.stripeSubscriptionId ?? null;
            priceId = sub?.planStripePriceId ?? null;
          }
          if (subId && typeof subId === "string") {
            return checkStripeSubscriptionActive(subId);
          }
          if (priceId && typeof priceId === "string") {
            return checkStripePriceActive(priceId);
          }
          return false;
        },
      }),
      ui: {
        description:
          "Whether the Stripe subscription is still active (or the Price is active if no subscription ID)",
      },
    }),
    /** Subscription status (e.g. active, cancelled) */
    status: select({
      type: "string",
      options: [...SUBSCRIPTION_STATUS_OPTIONS],
      defaultValue: "active",
      ui: { description: "Current subscription status" },
    }),
    /** Date when the subscription was activated */
    activatedAt: calendarDay({
      ui: { description: "Date when the subscription was activated" },
    }),
    /** End of current billing period (Stripe current_period_end) */
    currentPeriodEnd: calendarDay({
      ui: { description: "End of current billing period" },
    }),
    /** Stripe Subscription ID (e.g. sub_xxx) */
    stripeSubscriptionId: text({
      db: { isNullable: true },
      ui: { description: "Stripe Subscription ID" },
    }),
    /** Stripe Customer ID if needed (e.g. cus_xxx) */
    stripeCustomerId: text({
      db: { isNullable: true },
      ui: { description: "Stripe Customer ID" },
    }),
    /** Payments associated with this subscription */
    saasPayments: relationship({
      ref: "SaasPayment.subscription",
      many: true,
      ui: { description: "Payments for this subscription" },
    }),
    /** Subscription plan for this company */
    plan: relationship({
      ref: "SaasPlan.subscriptions",
      many: false,
      ui: {
        description: "Subscription plan (defines cost, frequency, lead limit)",
      },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
