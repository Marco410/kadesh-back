import { list } from "@keystone-6/core";
import { checkbox, float, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import {
  STORE_INVENTORY_POLICY,
  STORE_INVENTORY_POLICY_OPTIONS,
  STORE_PRODUCT_SOURCE,
  STORE_PRODUCT_SOURCE_OPTIONS,
  STORE_PRODUCT_STATUS,
  STORE_PRODUCT_STATUS_OPTIONS,
} from "../constants";
import {
  storeProductAfterOperation,
  storeProductBeforeOperation,
  storeProductResolveInput,
  storeProductValidateDelete,
  storeProductValidateInput,
} from "./StoreProduct.hooks";

const readOnly = { ui: { createView: { fieldMode: "hidden" as const }, itemView: { fieldMode: "read" as const } } };

/**
 * A product of the Kadesh Pet store. Money is in MXN cents. See ../README.md.
 *
 * Admin only through the generated API: shoppers read products with `storeCatalog` and
 * `storeCatalogProduct`, which never return `source`, cost or supplier.
 *
 * `priceCents`, `compareAtPriceCents`, `stockTotal`, `ratingAverage`, `ratingCount`, `salesCount`
 * and `nameSearch` are stored copies kept by the server: lists and filters never join variants or
 * reviews.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100 },
  db: {
    extendPrismaSchema: (schema) =>
      schema.replace(
        /\n\}\s*$/,
        "\n  @@unique([source, externalId])\n  @@index([status, categoryId])\n  @@index([status, publishedAt])\n}",
      ),
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "source", "status", "priceCents", "stockTotal"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  hooks: {
    resolveInput: storeProductResolveInput as any,
    validateInput: storeProductValidateInput as any,
    validateDelete: storeProductValidateDelete as any,
    beforeOperation: storeProductBeforeOperation as any,
    afterOperation: storeProductAfterOperation as any,
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: { description: "Se genera del nombre si se deja vacío." },
    }),
    nameSearch: text({ isIndexed: true, ...readOnly }),
    shortDescription: text(),
    description: text({ ui: { displayMode: "textarea" } }),

    source: select({
      type: "string",
      options: STORE_PRODUCT_SOURCE_OPTIONS,
      defaultValue: STORE_PRODUCT_SOURCE.OWN,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Interno. Al público, propio y Dropi salen como vendidos por Kadesh." },
    }),
    status: select({
      type: "string",
      options: STORE_PRODUCT_STATUS_OPTIONS,
      defaultValue: STORE_PRODUCT_STATUS.DRAFT,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    isFeatured: checkbox({ defaultValue: false }),
    publishedAt: timestamp({ ui: { itemView: { fieldMode: "read" } } }),

    category: relationship({ ref: "StoreCategory.products", many: false }),
    brand: relationship({ ref: "StoreBrand.products", many: false }),
    animalTypes: relationship({ ref: "AnimalType", many: true }),

    priceCents: integer({ defaultValue: 0, ...readOnly }),
    compareAtPriceCents: integer({ ...readOnly }),
    inventoryPolicy: select({
      type: "string",
      options: STORE_INVENTORY_POLICY_OPTIONS,
      defaultValue: STORE_INVENTORY_POLICY.TRACKED,
      validation: { isRequired: true },
    }),
    stockTotal: integer({ defaultValue: 0, ...readOnly }),

    externalId: text({
      db: { isNullable: true },
      ui: { description: "Id del producto en Dropi, o el MLM… de Mercado Libre." },
    }),
    externalUrl: text({ db: { isNullable: true } }),
    affiliateUrl: text({
      db: { isNullable: true },
      ui: { description: "Solo Mercado Libre: el enlace generado en el portal de afiliados." },
    }),
    dropiSupplierId: integer(),
    suggestedPriceCents: integer({ ui: { description: "Precio sugerido por Dropi." } }),
    externalSyncedAt: timestamp({
      ui: { description: "Dropi: última sincronización. Mercado Libre: última revisión del precio." },
    }),

    ratingAverage: float({ defaultValue: 0, ...readOnly }),
    ratingCount: integer({ defaultValue: 0, ...readOnly }),
    salesCount: integer({ defaultValue: 0, ...readOnly }),

    metaTitle: text(),
    metaDescription: text(),

    variants: relationship({ ref: "StoreProductVariant.product", many: true }),
    images: relationship({ ref: "StoreProductImage.product", many: true }),
    reviews: relationship({ ref: "StoreProductReview.product", many: true }),

    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
