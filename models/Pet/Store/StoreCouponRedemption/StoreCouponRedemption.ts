import { list } from "@keystone-6/core";
import { integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

/**
 * One use of a coupon: which order used it and who. One row per coupon and order (`key`). It is
 * written when the order is placed and deleted (with its use handed back) if the order is
 * cancelled unpaid or refunded. Only `utils/store/coupons.ts` writes it.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true, delete: true } },
  ui: {
    listView: { initialColumns: ["coupon", "order", "user", "discountCents", "createdAt"] },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "<couponId>:<orderId>", itemView: { fieldMode: "read" } },
    }),
    coupon: relationship({ ref: "StoreCoupon.redemptions", many: false }),
    order: relationship({ ref: "StoreOrder", many: false }),
    user: relationship({ ref: "User", many: false }),
    discountCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
