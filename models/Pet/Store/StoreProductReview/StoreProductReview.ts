import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { pawsOnStoreProductReview } from "../../../../utils/pet/pawsTriggers";
import { recomputeStoreProductRating } from "../../../../utils/store/catalog";
import { bumpStoreCatalogVersion } from "../../../../utils/store/config";
import { STORE_REVIEW_STATUS, STORE_REVIEW_STATUS_OPTIONS } from "../constants";

/**
 * A person's review of a product: one per person and product (`key`). Written by
 * `submitStoreProductReview` and `deleteMyStoreProductReview`; an admin hides one or answers it
 * with the generated update.
 *
 * The product keeps its stars in `ratingAverage` / `ratingCount`: every write recomputes them
 * (here for admin edits, in the mutations for shoppers, which write with prisma and skip hooks).
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true } },
  db: {
    // Published reviews of one product, newest first.
    extendPrismaSchema: (schema) =>
      schema.replace(/\n\}\s*$/, "\n  @@index([productId, status, createdAt])\n}"),
  },
  ui: {
    listView: {
      initialColumns: ["product", "user", "rating", "status", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  hooks: {
    afterOperation: async ({ operation, item, originalItem, context }: any) => {
      const productId = item?.productId ?? originalItem?.productId ?? null;
      try {
        await recomputeStoreProductRating(context, productId);
        bumpStoreCatalogVersion();
      } catch (error) {
        console.error("[store] could not recompute rating:", productId, error);
      }
      // An admin hid, republished or deleted it: its paws follow.
      void pawsOnStoreProductReview(context, {
        userId: item?.userId ?? originalItem?.userId ?? null,
        productId,
        shouldHave:
          operation !== "delete" && item?.status === STORE_REVIEW_STATUS.PUBLISHED && Boolean(item?.verifiedPurchase),
      });
    },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "<userId>:<productId>", itemView: { fieldMode: "read" } },
    }),
    product: relationship({ ref: "StoreProduct.reviews", many: false }),
    user: relationship({ ref: "User", many: false }),
    rating: integer({ validation: { isRequired: true, min: 1, max: 5 } }),
    title: text(),
    body: text({ ui: { displayMode: "textarea" } }),
    status: select({
      type: "string",
      options: STORE_REVIEW_STATUS_OPTIONS,
      defaultValue: STORE_REVIEW_STATUS.PUBLISHED,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    verifiedPurchase: checkbox({
      defaultValue: false,
      ui: { description: "La persona compró y recibió este producto en Kadesh." },
    }),
    adminReply: text({ ui: { displayMode: "textarea", description: "Respuesta pública de Kadesh." } }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
