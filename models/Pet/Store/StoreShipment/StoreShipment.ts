import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import {
  STORE_SHIPMENT_PROVIDER_OPTIONS,
  STORE_SHIPMENT_STATUS,
  STORE_SHIPMENT_STATUS_OPTIONS,
} from "../constants";

/**
 * A package of an order. Created when the order is paid: one for the products Kadesh ships and
 * one per Dropi supplier. Updated with `adminUpdateStoreShipment` (and by the Dropi sync later);
 * the order's `fulfillmentStatus` is derived from its shipments.
 *
 * `provider` and the Dropi fields are internal: shoppers only see carrier and tracking code.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true, delete: true } },
  ui: {
    listView: { initialColumns: ["order", "provider", "status", "carrier", "trackingCode"] },
  },
  fields: {
    order: relationship({ ref: "StoreOrder.shipments", many: false }),
    items: relationship({ ref: "StoreOrderItem.shipment", many: true }),
    provider: select({ type: "string", options: STORE_SHIPMENT_PROVIDER_OPTIONS, validation: { isRequired: true } }),
    status: select({
      type: "string",
      options: STORE_SHIPMENT_STATUS_OPTIONS,
      defaultValue: STORE_SHIPMENT_STATUS.PENDING,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    carrier: text(),
    trackingCode: text(),
    trackingUrl: text(),
    shippingCostCents: integer({ ui: { description: "Lo que le costó a Kadesh este envío." } }),

    dropiOrderId: text({ isIndexed: "unique", db: { isNullable: true } }),
    dropiStatus: text({ ui: { description: "Estatus tal como lo dice Dropi." } }),
    dropiSupplierId: integer(),
    approvedBy: relationship({ ref: "User", many: false }),
    approvedAt: timestamp(),

    shippedAt: timestamp(),
    deliveredAt: timestamp(),
    lastSyncedAt: timestamp(),
    lastError: text(),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
