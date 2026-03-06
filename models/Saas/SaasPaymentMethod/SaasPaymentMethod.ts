import { list } from "@keystone-6/core";
import { text, timestamp, relationship } from "@keystone-6/core/fields";
import { saasPaymentMethodAccess } from "./SaasPaymentMethod.access";

export default list({
  access: saasPaymentMethodAccess,
  ui: {
    listView: {
      initialColumns: [
        "ownerName",
        "cardType",
        "lastFourDigits",
        "stripePaymentMethodId",
        "country",
      ],
    },
  },
  fields: {
    /** User that owns this payment method */
    user: relationship({
      ref: "User.saasPaymentMethods",
      many: false,
      ui: { description: "User who owns this card" },
    }),
    /** Card type (e.g. card) */
    cardType: text({
      ui: { description: "Payment method type from Stripe (e.g. card)" },
    }),
    /** Last 4 digits of the card */
    lastFourDigits: text({
      ui: { description: "Last 4 digits of the card" },
    }),
    expMonth: text({
      ui: { description: "Expiration month (1-12)" },
    }),
    expYear: text({
      ui: { description: "Expiration year" },
    }),
    /** Processor identifier (e.g. stripe), placeholder allowed */
    stripeProcessorId: text({
      ui: { description: "Payment processor ID (e.g. stripe)" },
    }),
    /** Stripe PaymentMethod ID (pm_xxx) */
    stripePaymentMethodId: text({
      isIndexed: "unique",
      ui: { description: "Stripe PaymentMethod ID" },
    }),
    address: text({
      db: { isNullable: true },
      ui: { description: "Billing address" },
    }),
    postalCode: text({
      db: { isNullable: true },
      ui: { description: "Postal / ZIP code" },
    }),
    ownerName: text({
      ui: { description: "Cardholder name" },
    }),
    /** Two-letter country code (e.g. US, MX) */
    country: text({
      db: { isNullable: true },
      ui: { description: "Country code from card" },
    }),
    /** Payments made with this payment method */
    saasPayments: relationship({
      ref: "SaasPayment.paymentMethod",
      many: true,
      ui: { description: "Payments that used this card" },
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
