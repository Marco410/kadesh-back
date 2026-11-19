import { list } from "@keystone-6/core";
import { integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

/**
 * A line of an order. Name, price, cost and where it comes from are copies taken when the order
 * was placed, so the line still reads right if the product changes or is deleted.
 *
 * `source`, `unitCostCents` and the Dropi ids are internal: shoppers never see them.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200, omit: { create: true, update: true, delete: true } },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["order", "name", "variantTitle", "quantity", "totalCents"] },
  },
  fields: {
    order: relationship({ ref: "StoreOrder.items", many: false }),
    product: relationship({ ref: "StoreProduct", many: false }),
    variant: relationship({ ref: "StoreProductVariant", many: false }),
    shipment: relationship({ ref: "StoreShipment.items", many: false }),

    name: text({ validation: { isRequired: true } }),
    variantTitle: text(),
    sku: text(),
    source: text({ ui: { description: "own | dropi" } }),
    externalId: text({ db: { isNullable: true }, ui: { description: "Id del producto en Dropi." } }),
    dropiVariationId: integer(),
    dropiSupplierId: integer(),

    unitPriceCents: integer({ validation: { isRequired: true } }),
    unitCostCents: integer(),
    quantity: integer({ validation: { isRequired: true, min: 1 } }),
    discountCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    totalCents: integer({ validation: { isRequired: true } }),
    reservedQuantity: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: { description: "Piezas apartadas del stock por esta línea. Vuelven al stock si el pedido se cancela." },
    }),

    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
