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
} from "@keystone-6/core/fields";
import { saasCompanySubscriptionAccess } from "./SaasCompanySubscription.access";
import { SUBSCRIPTION_STATUS_OPTIONS } from "./constants";

/** Fetches Stripe Price and returns whether it is active. Uses STRIPE_SECRET_KEY. */
async function checkStripePriceActive(priceId: string): Promise<boolean> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return false;
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
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
    /** Virtual: checks Stripe API if the contracted price (planStripePriceId) is still active. Requires STRIPE_SECRET_KEY. */
    activeInStripe: virtual({
      field: graphql.field({
        type: graphql.Boolean,
        async resolve(
          item: { id: string; planStripePriceId?: string | null },
          _args,
          context
        ) {
          let priceId = item.planStripePriceId;
          if ((!priceId || typeof priceId !== "string") && item.id) {
            const sub = await context.sudo().query.SaasCompanySubscription.findOne({
              where: { id: item.id },
              query: "planStripePriceId",
            });
            priceId =
              (sub as { planStripePriceId?: string | null } | null)?.planStripePriceId ?? null;
          }
          if (!priceId || typeof priceId !== "string") return false;
          return checkStripePriceActive(priceId);
        },
      }),
      ui: {
        description:
          "Whether the contracted price is still active in Stripe (fetched from Stripe API)",
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
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } },
    }),
  },
});
