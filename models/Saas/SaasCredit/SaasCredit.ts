import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  select,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { saasCreditAccess } from "./SaasCredit.access";
import { PLAN_FREQUENCY_OPTIONS } from "../SaasPlan/constants";

export default list({
  access: saasCreditAccess,
  ui: {
    listView: {
      initialColumns: [
        "slug",
        "name",
        "cost",
        "creditsToAdd",
        "frequency",
        "active",
        "bestSeller",
        "stripePriceId",
      ],
    },
  },
  fields: {
    /** Internal key for upsert/seed (e.g. "Recarga Básica") */
    slug: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: { description: "Internal package key (e.g. Recarga Básica)" },
    }),
    /** Package display name shown in the app */
    name: text({
      validation: { isRequired: true },
      ui: { description: "Display name (e.g. 250 Créditos Extra)" },
    }),
    /** One-time price amount (in package currency) */
    cost: float({
      ui: { description: "One-time package cost" },
    }),
    costOld: float({
      ui: { description: "Original price for strikethrough discount display" },
    }),
    /** Payment frequency (one-time for credit top-ups) */
    frequency: select({
      type: "string",
      options: [...PLAN_FREQUENCY_OPTIONS],
      defaultValue: "once",
      ui: { description: "Payment frequency (once for credit packages)" },
    }),
    /** ISO 4217 currency code for Stripe (e.g. mxn, usd) */
    currency: text({
      defaultValue: "mxn",
      ui: { description: "Stripe currency code (e.g. mxn, usd)" },
    }),
    /** Number of extra lead-sync credits added on purchase */
    creditsToAdd: integer({
      validation: { isRequired: true },
      ui: { description: "Credits added to the company on successful purchase" },
    }),
    /** Shown in app and available for purchase */
    active: checkbox({
      defaultValue: true,
      ui: { description: "Package enabled in app (visible for purchase)" },
    }),
    bestSeller: checkbox({
      defaultValue: false,
      ui: { description: "Highlight this package as best seller" },
    }),
    /** Stripe Price ID (e.g. price_xxx). Required for one-time checkout. */
    stripePriceId: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        description:
          "Stripe Price ID (one-time price from Stripe Dashboard or API)",
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
