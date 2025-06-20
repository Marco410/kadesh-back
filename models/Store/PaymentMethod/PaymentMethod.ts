import {
  text,
  checkbox,
  timestamp,
  relationship,
  select,
} from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import access from "../../../utils/generalAccess/access";
import { PAYMENT_TYPES } from "../../../utils/constants/constants";

export default list({
  access,

  fields: {
    user: relationship({
      ref: "User",
    }),
    cardType: text(),
    isDefault: checkbox(),
    lastFourDigits: text(),
    expMonth: text(),
    expYear: text(),
    stripeProcessorId: text(),
    address: text(),
    postalCode: text(),
    ownerName: text(),
    country: text(), // Two-letter country code (ISO 3166-1 alpha-2).
    payment: relationship({
      ref: "Payment.paymentMethod",
      many: true,
    }),
    type: select({ options: PAYMENT_TYPES }),

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
