import {
  text,
  select,
  decimal,
  timestamp,
  relationship,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    order_payment: relationship({
      ref: "Order.payment",
    }),
    paymentMethod: relationship({
      ref: "PaymentMethod.payment",
    }),
    amount: decimal({
      scale: 6,
      defaultValue: "0.000000",
    }),
    status: select({
      type: "enum",
      validation: {
        isRequired: true,
      },
      defaultValue: "pending",
      options: [
        { label: "Pendiente", value: "pending" },
        { label: "Procesando", value: "processing" },
        { label: "Exitoso", value: "succeeded" },
        { label: "Cancelado", value: "cancelled" },
        { label: "Fallido", value: "failed" },
        { label: "Devuelto", value: "refunded" },
      ],
    }),
    processorStripeChargeId: text(),
    stripeErrorMessage: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    processorRefundId: text(),

    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: timestamp({
      defaultValue: { kind: "now" },
      db: { updatedAt: true },
    }),
  },
});
