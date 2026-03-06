import { list } from "@keystone-6/core";
import {
  text,
  decimal,
  select,
  timestamp,
  relationship,
} from "@keystone-6/core/fields";
import { saasPaymentAccess } from "./SaasPayment.access";

export default list({
  access: saasPaymentAccess,
  ui: {
    listView: {
      initialColumns: [
        "user",
        "amount",
        "status",
        "paymentMethodType",
        "processorStripeChargeId",
        "plan",
        "subscription",
        "createdAt",
      ],
    },
  },
  fields: {
    /** User who made the payment */
    user: relationship({
      ref: "User.saasPayments",
      many: false,
      ui: { description: "User who made this payment" },
    }),
    /** When no linked SaasPaymentMethod (e.g. failed attempt), store type as string (e.g. 'card') */
    paymentMethodType: text({
      db: { isNullable: true },
      ui: {
        description:
          "Payment method type when no card is linked (e.g. 'card' for failed attempts)",
      },
    }),
    /** Saved payment method used (when payment succeeded and we have a method id) */
    paymentMethod: relationship({
      ref: "SaasPaymentMethod.saasPayments",
      many: false,
      ui: { description: "Saved payment method used for this payment" },
    }),
    amount: decimal({
      scale: 6,
      defaultValue: "0",
      ui: { description: "Amount charged (e.g. in cents or unit currency)" },
    }),
    status: select({
      type: "string",
      options: [
        { label: "Pendiente", value: "pending" },
        { label: "Procesando", value: "processing" },
        { label: "Exitoso", value: "succeeded" },
        { label: "Cancelado", value: "cancelled" },
        { label: "Fallido", value: "failed" },
        { label: "Devuelto", value: "refunded" },
      ],
      defaultValue: "pending",
      ui: { description: "Payment status" },
    }),
    processorStripeChargeId: text({
      defaultValue: "",
      ui: { description: "Stripe PaymentIntent or Charge ID" },
    }),
    stripeErrorMessage: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Stripe error message (e.g. when status is failed)",
      },
    }),
    notes: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Optional notes" },
    }),
    /** Plan this payment is for (optional) */
    plan: relationship({
      ref: "SaasPlan.saasPayments",
      many: false,
      ui: { description: "Plan this payment is associated with" },
    }),
    /** Subscription this payment is for (optional) */
    subscription: relationship({
      ref: "SaasCompanySubscription.saasPayments",
      many: false,
      ui: { description: "Subscription this payment is associated with" },
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
