import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { order_status } from "../../../utils/constants/constants";

export default list({
  access,
  fields: {
    total: integer(),
    status: select({ validation: { isRequired: true }, options: order_status }),
    cart: relationship({
      ref: "Cart",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    payment: relationship({
      ref: "Payment.order_payment",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
