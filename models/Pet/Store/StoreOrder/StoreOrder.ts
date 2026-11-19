import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import {
  STORE_FULFILLMENT_STATUS,
  STORE_FULFILLMENT_STATUS_OPTIONS,
  STORE_ORDER_CHANNEL,
  STORE_ORDER_STATUS,
  STORE_ORDER_STATUS_OPTIONS,
  STORE_PAYMENT_METHOD_OPTIONS,
  STORE_PAYMENT_STATUS,
  STORE_PAYMENT_STATUS_OPTIONS,
} from "../constants";

/**
 * An order of the Kadesh Pet store. Money is in MXN cents and is a copy taken when the order was
 * placed: later price changes do not touch it. The shipping address is copied too (`ship*`).
 *
 * Three statuses that move on their own: `status` (the order as a whole), `paymentStatus` and
 * `fulfillmentStatus` (derived from its shipments).
 *
 * Nothing writes an order through the generated API: placing, paying, cancelling and refunding go
 * through `utils/store/orders.ts`, which keeps stock, payments, shipments and the timeline
 * (`StoreOrderEvent`) in step.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true, delete: true } },
  db: {
    extendPrismaSchema: (schema) =>
      schema.replace(
        /\n\}\s*$/,
        "\n  @@index([userId, createdAt])\n  @@index([paymentStatus, createdAt])\n  @@index([fulfillmentStatus, createdAt])\n  @@index([status, expiresAt])\n  @@index([paidAt])\n}",
      ),
  },
  ui: {
    labelField: "number",
    listView: {
      initialColumns: ["number", "customerName", "paymentStatus", "fulfillmentStatus", "totalCents", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    number: text({ isIndexed: "unique", validation: { isRequired: true }, ui: { description: "Folio: KP-XXXXXXXX" } }),
    user: relationship({ ref: "User", many: false }),
    customerName: text(),
    email: text(),
    phone: text(),
    channel: select({
      type: "string",
      options: [
        { label: "Web", value: STORE_ORDER_CHANNEL.WEB },
        { label: "App", value: STORE_ORDER_CHANNEL.APP },
      ],
      defaultValue: STORE_ORDER_CHANNEL.WEB,
    }),
    guestCheckout: checkbox({
      defaultValue: false,
      ui: { description: "La cuenta se creó al hacer este pedido." },
    }),

    status: select({
      type: "string",
      options: STORE_ORDER_STATUS_OPTIONS,
      defaultValue: STORE_ORDER_STATUS.OPEN,
      validation: { isRequired: true },
    }),
    paymentStatus: select({
      type: "string",
      options: STORE_PAYMENT_STATUS_OPTIONS,
      defaultValue: STORE_PAYMENT_STATUS.PENDING,
      validation: { isRequired: true },
    }),
    fulfillmentStatus: select({
      type: "string",
      options: STORE_FULFILLMENT_STATUS_OPTIONS,
      defaultValue: STORE_FULFILLMENT_STATUS.UNFULFILLED,
      validation: { isRequired: true },
    }),

    unitsCount: integer({ defaultValue: 0, ui: { description: "Piezas en total (suma de cantidades)." } }),
    subtotalCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    couponCode: text({ db: { isNullable: true } }),
    couponDiscountCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    shippingCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    totalCents: integer({ defaultValue: 0, validation: { isRequired: true } }),
    costCents: integer({ defaultValue: 0, ui: { description: "Lo que le cuestan a Kadesh los productos. Solo admin." } }),

    paymentMethod: select({ type: "string", options: STORE_PAYMENT_METHOD_OPTIONS, validation: { isRequired: true } }),
    stripePaymentIntentId: text({ isIndexed: "unique", db: { isNullable: true } }),
    paidAt: timestamp(),
    expiresAt: timestamp({ ui: { description: "Sin pagar para esta hora, el pedido se cancela solo." } }),
    cancelledAt: timestamp(),
    cancelReason: text(),

    shipRecipientName: text(),
    shipPhone: text(),
    shipStreet: text(),
    shipExteriorNumber: text(),
    shipInteriorNumber: text(),
    shipNeighborhood: text(),
    shipCity: text(),
    shipStateCode: text(),
    shipPostalCode: text(),
    shipReferences: text(),

    customerNote: text({ ui: { displayMode: "textarea" } }),
    adminNote: text({ ui: { displayMode: "textarea" } }),
    searchText: text({ isIndexed: true, ui: { description: "Folio, nombre, correo y teléfono, para buscar." } }),

    items: relationship({ ref: "StoreOrderItem.order", many: true }),
    payments: relationship({ ref: "StorePayment.order", many: true }),
    shipments: relationship({ ref: "StoreShipment.order", many: true }),
    events: relationship({ ref: "StoreOrderEvent.order", many: true }),

    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
