import { list } from "@keystone-6/core";
import { checkbox, integer, json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { recomputeStoreProductTotals } from "../../../../utils/store/catalog";

/**
 * What is actually sold: every product has at least one variant, and carts and orders always point
 * at a variant. A product without options has a single variant with an empty `title`.
 *
 * Money is in MXN cents. `costCents` (what Kadesh pays) never leaves the admin.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200 },
  ui: {
    labelField: "title",
    listView: { initialColumns: ["product", "title", "sku", "priceCents", "stock", "isActive"] },
  },
  hooks: {
    validateInput: ({ operation, resolvedData, addValidationError }: any) => {
      if (operation === "delete") return;
      for (const field of ["priceCents", "compareAtPriceCents", "costCents", "stock", "weightGrams"]) {
        const value = resolvedData[field];
        if (typeof value === "number" && value < 0) addValidationError(`${field} no puede ser negativo.`);
      }
    },
    // The product keeps a copy of its cheapest price and total stock.
    afterOperation: async ({ operation, item, originalItem, inputData, context }: any) => {
      const productId = item?.productId ?? originalItem?.productId ?? null;
      const priceTouched = operation === "create" || inputData?.priceCents !== undefined;
      await recomputeStoreProductTotals(context, productId, { priceTouched });
      const previous = originalItem?.productId ?? null;
      if (previous && previous !== productId) await recomputeStoreProductTotals(context, previous);
    },
  },
  fields: {
    product: relationship({ ref: "StoreProduct.variants", many: false }),
    title: text({ ui: { description: "Por ejemplo «Talla M / Rojo». Vacío si el producto no tiene opciones." } }),
    sku: text({ isIndexed: true, db: { isNullable: true } }),
    options: json({ ui: { description: 'Opciones como objeto plano: { "Talla": "M", "Color": "Rojo" }' } }),
    priceCents: integer({ validation: { isRequired: true }, defaultValue: 0 }),
    compareAtPriceCents: integer({ ui: { description: "Precio anterior, para mostrarlo tachado." } }),
    costCents: integer({ ui: { description: "Lo que paga Kadesh. Solo admin." } }),
    stock: integer({ defaultValue: 0, validation: { isRequired: true } }),
    dropiVariationId: integer(),
    weightGrams: integer(),
    order: integer({ defaultValue: 1, validation: { isRequired: true } }),
    isActive: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
