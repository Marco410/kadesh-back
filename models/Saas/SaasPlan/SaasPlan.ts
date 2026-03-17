import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  select,
  relationship,
  timestamp,
  checkbox,
  json,
} from "@keystone-6/core/fields";
import { saasPlanAccess } from "./SaasPlan.access";
import { PLAN_FREQUENCY_OPTIONS } from "./constants";

export default list({
  access: saasPlanAccess,
  ui: {
    listView: {
      initialColumns: [
        "name",
        "cost",
        "frequency",
        "leadLimit",
        "planFeatures",
        "active",
        "stripePriceId",
        "companies",
      ],
    },
  },
  fields: {
    /** Plan display name */
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Plan name (e.g. Starter, Pro, Enterprise)" },
    }),
    /** Price amount (in plan currency) */
    cost: float({
      ui: { description: "Plan cost per billing period" },
    }),
    /** Referral commission percentage for upfront payment (e.g. 20 = 20%) */
    referralUpfrontCommissionPct: float({
      ui: {
        description:
          "Referral upfront commission percentage (e.g. 20 = 20% of first payment)",
      },
    }),
    /** Referral commission percentage for recurring payments (e.g. 10 = 10%) */
    referralRecurringCommissionPct: float({
      ui: {
        description:
          "Referral recurring commission percentage per billing period (e.g. 10 = 10%)",
      },
    }),
    /** Billing frequency: weekly, monthly, or annual */
    frequency: select({
      type: "string",
      options: [...PLAN_FREQUENCY_OPTIONS],
      ui: { description: "Billing frequency (weekly, monthly, annual)" },
    }),
    /** ISO 4217 currency code for Stripe (e.g. mxn, usd) */
    currency: text({
      defaultValue: "mxn",
      ui: { description: "Stripe currency code (e.g. mxn, usd)" },
    }),
    leadLimit: integer({
      ui: {
        description: "Max leads that can be synced per month for this plan",
      },
    }),
    /**
     * Plan features: what this plan offers. JSON array of { key, name, description? }.
     * key: used in code to enable/check feature (e.g. "lead_sync", "reports", "api_access").
     * name: display name. description: optional.
     * Copied to SaasCompanySubscription.planFeatures when subscribing.
     */
    planFeatures: json({
      ui: {
        description:
          'Features included in this plan. Array of { "key": "lead_sync", "name": "Lead sync", "description": "Optional" }. Key is used to enable features in the app.',
      },
    }),
    /** Payments associated with this plan */
    saasPayments: relationship({
      ref: "SaasPayment.plan",
      many: true,
      ui: { description: "Payments for this plan" },
    }),
    /** Shown in app and available for new signups */
    active: checkbox({
      defaultValue: true,
      ui: { description: "Plan enabled in app (visible for new signups)" },
    }),
    bestSeller: checkbox({
      defaultValue: false,
      ui: { description: "Plan best seller" },
    }),
    /** Stripe Price ID (e.g. price_xxx). Required to create subscriptions. */
    stripePriceId: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        description:
          "Stripe Price ID (from Stripe Dashboard or API when creating Price)",
      },
    }),
    /** Stripe Product ID (e.g. prod_xxx). Product that contains this price. */
    stripeProductId: text({
      db: { isNullable: true },
      ui: {
        description:
          "Stripe Product ID (optional, from Stripe when creating Product)",
      },
    }),
    /** Companies currently on this plan */
    companies: relationship({
      ref: "SaasCompany.plan",
      many: true,
      ui: { description: "Companies on this plan" },
    }),
    subscriptions: relationship({
      ref: "SaasCompanySubscription.plan",
      many: true,
      ui: { description: "Subscriptions for this plan" },
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
