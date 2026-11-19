import { list } from "@keystone-6/core";
import { image, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import {
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS_OPTIONS,
  STORE_PAYMENT_METHOD_OPTIONS,
} from "../constants";

/**
 * A payment of an order: a Stripe PaymentIntent or a bank transfer with its proof. Written only
 * by `utils/store/orders.ts` and the Stripe webhook.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true, delete: true } },
  ui: {
    listView: { initialColumns: ["order", "provider", "amountCents", "status", "createdAt"] },
  },
  fields: {
    order: relationship({ ref: "StoreOrder.payments", many: false }),
    provider: select({ type: "string", options: STORE_PAYMENT_METHOD_OPTIONS, validation: { isRequired: true } }),
    amountCents: integer({ validation: { isRequired: true } }),
    status: select({
      type: "string",
      options: STORE_PAYMENT_ATTEMPT_STATUS_OPTIONS,
      defaultValue: STORE_PAYMENT_ATTEMPT_STATUS.PENDING,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    stripePaymentIntentId: text({ isIndexed: true, db: { isNullable: true } }),
    stripeChargeId: text({ isIndexed: "unique", db: { isNullable: true } }),
    stripeRefundId: text({ db: { isNullable: true } }),
    refundedCents: integer({ defaultValue: 0 }),

    transferProof: image({ storage: "s3_store" }),
    transferReference: text({ ui: { description: "Lo que la persona escribió como referencia o clave de rastreo." } }),
    reviewedBy: relationship({ ref: "User", many: false }),
    reviewedAt: timestamp(),

    errorMessage: text(),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
