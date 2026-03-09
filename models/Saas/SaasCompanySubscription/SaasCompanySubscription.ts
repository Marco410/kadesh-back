import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  calendarDay,
  select,
  relationship,
  timestamp,
  json,
} from "@keystone-6/core/fields";
import { saasCompanySubscriptionAccess } from "./SaasCompanySubscription.access";
import { SUBSCRIPTION_STATUS_OPTIONS } from "./constants";

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
    /** Subscription status (e.g. active, cancelled). Use query subscriptionStatus to verify against Stripe and get activeInStripe. */
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
