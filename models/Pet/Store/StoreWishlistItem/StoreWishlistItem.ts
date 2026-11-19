import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

/**
 * A product a person saved: one row per person and product (`key`). Written only by
 * `setStoreWishlist`; read with `myStoreWishlist` and `myStoreWishlistIds`.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true } },
  ui: {
    listView: { initialColumns: ["user", "product", "createdAt"] },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "<userId>:<productId>", itemView: { fieldMode: "read" } },
    }),
    user: relationship({ ref: "User", many: false }),
    product: relationship({ ref: "StoreProduct", many: false }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
