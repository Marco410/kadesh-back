import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  select,
  relationship,
  timestamp,
  checkbox,
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
      ui: { description: "Max leads that can be synced per month for this plan" },
    }),
    companies: relationship({
      ref: "SaasCompany.plan",
      many: true,
      ui: { description: "Companies using this plan" },
    }),
    /** Shown in app and available for new signups */
    active: checkbox({
      defaultValue: true,
      ui: { description: "Plan enabled in app (visible for new signups)" },
    }),
    /** Stripe Price ID (e.g. price_xxx). Required to create subscriptions. */
    stripePriceId: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        description: "Stripe Price ID (from Stripe Dashboard or API when creating Price)",
      },
    }),
    /** Stripe Product ID (e.g. prod_xxx). Product that contains this price. */
    stripeProductId: text({
      db: { isNullable: true },
      ui: {
        description: "Stripe Product ID (optional, from Stripe when creating Product)",
      },
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
