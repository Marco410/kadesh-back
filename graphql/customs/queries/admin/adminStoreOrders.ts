import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_ADMIN_MAX_TAKE,
  STORE_FULFILLMENT_STATUS,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_STATUS,
} from "../../../../models/Pet/Store/constants";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import { storeStateName } from "../../../../utils/store/address";
import { loadStoreCovers, storeImageUrl } from "../../../../utils/store/catalog";
import { PERSON_SELECT, adminPrisma, assertPlatformAdmin, clampInt, personRef, toIso, unwrapPrisma } from "./shared";

/**
 * Store orders in Operaciones (Kadesh Pet → Tienda → Pedidos). Platform admin only. Unlike the
 * buyer's view this one shows where each product comes from, what it cost, who fulfils each
 * package and who did every step.
 */

const typeDefs = `
  type AdminStoreOrderRow {
    id: ID!
    number: String!
    createdAt: String
    customerName: String
    email: String
    status: String!
    paymentStatus: String!
    fulfillmentStatus: String!
    paymentMethod: String!
    totalCents: Int!
    itemsCount: Int!
    shipCity: String
    shipStateName: String
    guestCheckout: Boolean!
    expiresAt: String
  }

  type AdminStoreOrdersResult {
    total: Int!
    items: [AdminStoreOrderRow!]!
    "Orders that need someone: toReview (transfer proofs), toFulfill (paid, not fully shipped), awaitingPayment."
    queues: [AdminCount!]!
  }

  type AdminStoreOrderLine {
    id: ID!
    productId: ID
    name: String!
    variantTitle: String
    sku: String
    "own | dropi"
    source: String
    externalId: String
    dropiVariationId: Int
    coverUrl: String
    quantity: Int!
    unitPriceCents: Int!
    unitCostCents: Int
    totalCents: Int!
    shipmentId: ID
  }

  type AdminStorePayment {
    id: ID!
    provider: String!
    amountCents: Int!
    status: String!
    stripePaymentIntentId: String
    stripeChargeId: String
    refundedCents: Int
    "Signed for 1 h."
    transferProofUrl: String
    transferReference: String
    reviewedBy: AdminPersonRef
    reviewedAt: String
    errorMessage: String
    createdAt: String
  }

  type AdminStoreShipment {
    id: ID!
    "own | dropi"
    provider: String!
    status: String!
    carrier: String
    trackingCode: String
    trackingUrl: String
    shippingCostCents: Int
    dropiOrderId: String
    dropiStatus: String
    dropiSupplierId: Int
    approvedBy: AdminPersonRef
    approvedAt: String
    shippedAt: String
    deliveredAt: String
    lastError: String
  }

  type AdminStoreOrderEvent {
    id: ID!
    type: String!
    message: String
    fromStatus: String
    toStatus: String
    isPublic: Boolean!
    "null = the system (Stripe, cron)"
    actor: AdminPersonRef
    createdAt: String
  }

  type AdminStoreOrderDetail {
    order: AdminStoreOrderRow!
    user: AdminPersonRef
    phone: String
    subtotalCents: Int!
    shippingCents: Int!
    couponCode: String
    couponDiscountCents: Int!
    costCents: Int!
    "What Kadesh paid to ship it, added up from its shipments."
    shippingCostCents: Int!
    stripePaymentIntentId: String
    paidAt: String
    cancelledAt: String
    cancelReason: String
    customerNote: String
    adminNote: String
    address: StoreShippingAddress!
    items: [AdminStoreOrderLine!]!
    payments: [AdminStorePayment!]!
    shipments: [AdminStoreShipment!]!
    events: [AdminStoreOrderEvent!]!
  }
`;

const definition = `
  adminStoreOrders(
    search: String
    "toReview | toFulfill | awaitingPayment | shipped | completed | cancelled"
    queue: String
    paymentMethod: String
    take: Int
    skip: Int
  ): AdminStoreOrdersResult!
  adminStoreOrder(id: ID!): AdminStoreOrderDetail
`;

/** The working queues of the store, as `where` clauses. */
export const STORE_ORDER_QUEUES: Record<string, Record<string, unknown>> = {
  toReview: { status: STORE_ORDER_STATUS.OPEN, paymentStatus: STORE_PAYMENT_STATUS.IN_REVIEW },
  toFulfill: {
    status: STORE_ORDER_STATUS.OPEN,
    paymentStatus: STORE_PAYMENT_STATUS.PAID,
    fulfillmentStatus: { in: [STORE_FULFILLMENT_STATUS.UNFULFILLED, STORE_FULFILLMENT_STATUS.PARTIAL] },
  },
  awaitingPayment: { status: STORE_ORDER_STATUS.OPEN, paymentStatus: STORE_PAYMENT_STATUS.PENDING },
  shipped: { status: STORE_ORDER_STATUS.OPEN, fulfillmentStatus: STORE_FULFILLMENT_STATUS.SHIPPED },
  completed: { status: STORE_ORDER_STATUS.COMPLETED },
  cancelled: { status: STORE_ORDER_STATUS.CANCELLED },
};

const COUNTED_QUEUES = ["toReview", "toFulfill", "awaitingPayment"] as const;

const ROW_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  customerName: true,
  email: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  paymentMethod: true,
  totalCents: true,
  unitsCount: true,
  shipCity: true,
  shipStateCode: true,
  guestCheckout: true,
  expiresAt: true,
} as const;

function toRow(order: Record<string, any>) {
  return {
    id: order.id,
    number: order.number,
    createdAt: toIso(order.createdAt),
    customerName: order.customerName || null,
    email: order.email || null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.paymentMethod,
    totalCents: Number(order.totalCents) || 0,
    itemsCount: Number(order.unitsCount) || 0,
    shipCity: order.shipCity || null,
    shipStateName: storeStateName(order.shipStateCode) || null,
    guestCheckout: Boolean(order.guestCheckout),
    expiresAt: toIso(order.expiresAt),
  };
}

type Args = {
  search?: string | null;
  queue?: string | null;
  paymentMethod?: string | null;
  take?: number | null;
  skip?: number | null;
};

const resolver = {
  adminStoreOrders: async (_root: unknown, args: Args, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const take = clampInt(args.take, 1, STORE_ADMIN_MAX_TAKE, 25);
    const skip = clampInt(args.skip, 0, 1_000_000, 0);

    const and: Array<Record<string, unknown>> = [];
    const search = normalizeSearchText(args.search);
    if (search) and.push({ searchText: { contains: search } });
    if (args.queue && STORE_ORDER_QUEUES[args.queue]) and.push(STORE_ORDER_QUEUES[args.queue]);
    if (args.paymentMethod) and.push({ paymentMethod: args.paymentMethod });
    const where = { AND: and };

    // Two rounds instead of five queries at once: the server pool has 5 connections.
    const [rows, total] = await Promise.all([
      prisma.storeOrder.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take, skip, select: ROW_SELECT }),
      prisma.storeOrder.count({ where }),
    ]);
    const queueCounts = await Promise.all(
      COUNTED_QUEUES.map((queue) => prisma.storeOrder.count({ where: STORE_ORDER_QUEUES[queue] })),
    );

    return {
      total: Number(unwrapPrisma(total)) || 0,
      items: (unwrapPrisma(rows) as Array<Record<string, any>>).map(toRow),
      queues: COUNTED_QUEUES.map((queue, index) => ({ key: queue, count: Number(unwrapPrisma(queueCounts[index])) || 0 })),
    };
  },

  adminStoreOrder: async (_root: unknown, { id }: { id: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const order = unwrapPrisma(
      await prisma.storeOrder.findUnique({
        where: { id },
        select: {
          ...ROW_SELECT,
          phone: true,
          subtotalCents: true,
          shippingCents: true,
          couponCode: true,
          couponDiscountCents: true,
          costCents: true,
          stripePaymentIntentId: true,
          paidAt: true,
          cancelledAt: true,
          cancelReason: true,
          customerNote: true,
          adminNote: true,
          shipRecipientName: true,
          shipPhone: true,
          shipStreet: true,
          shipExteriorNumber: true,
          shipInteriorNumber: true,
          shipNeighborhood: true,
          shipPostalCode: true,
          shipReferences: true,
          user: { select: PERSON_SELECT },
        },
      }),
    ) as Record<string, any> | null;
    if (!order) return null;

    const [items, payments, shipments, events] = await Promise.all([
      prisma.storeOrderItem.findMany({
        where: { orderId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          productId: true,
          name: true,
          variantTitle: true,
          sku: true,
          source: true,
          externalId: true,
          dropiVariationId: true,
          quantity: true,
          unitPriceCents: true,
          unitCostCents: true,
          totalCents: true,
          shipmentId: true,
        },
      }),
      prisma.storePayment.findMany({
        where: { orderId: id },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          provider: true,
          amountCents: true,
          status: true,
          stripePaymentIntentId: true,
          stripeChargeId: true,
          refundedCents: true,
          transferProof_id: true,
          transferProof_extension: true,
          transferReference: true,
          reviewedAt: true,
          errorMessage: true,
          createdAt: true,
          reviewedBy: { select: PERSON_SELECT },
        },
      }),
      prisma.storeShipment.findMany({
        where: { orderId: id },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          provider: true,
          status: true,
          carrier: true,
          trackingCode: true,
          trackingUrl: true,
          shippingCostCents: true,
          dropiOrderId: true,
          dropiStatus: true,
          dropiSupplierId: true,
          approvedAt: true,
          shippedAt: true,
          deliveredAt: true,
          lastError: true,
          approvedBy: { select: PERSON_SELECT },
        },
      }),
      prisma.storeOrderEvent.findMany({
        where: { orderId: id },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          type: true,
          message: true,
          fromStatus: true,
          toStatus: true,
          isPublic: true,
          createdAt: true,
          actor: { select: PERSON_SELECT },
        },
      }),
    ]);

    const lines = unwrapPrisma(items) as Array<Record<string, any>>;
    const covers = await loadStoreCovers(
      context,
      [...new Set(lines.map((line) => line.productId).filter((productId): productId is string => Boolean(productId)))],
    );
    const shipmentRows = unwrapPrisma(shipments) as Array<Record<string, any>>;
    const paymentRows = await Promise.all(
      (unwrapPrisma(payments) as Array<Record<string, any>>).map(async (payment) => ({
        id: payment.id,
        provider: payment.provider,
        amountCents: payment.amountCents,
        status: payment.status,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeChargeId: payment.stripeChargeId,
        refundedCents: payment.refundedCents,
        transferProofUrl: payment.transferProof_id
          ? await storeImageUrl(context, {
              image_id: payment.transferProof_id,
              image_extension: payment.transferProof_extension,
              externalUrl: null,
            })
          : null,
        transferReference: payment.transferReference || null,
        reviewedBy: personRef(payment.reviewedBy),
        reviewedAt: toIso(payment.reviewedAt),
        errorMessage: payment.errorMessage || null,
        createdAt: toIso(payment.createdAt),
      })),
    );

    return {
      order: toRow(order),
      user: personRef(order.user),
      phone: order.phone || null,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      couponCode: order.couponCode || null,
      couponDiscountCents: Number(order.couponDiscountCents) || 0,
      costCents: Number(order.costCents) || 0,
      shippingCostCents: shipmentRows.reduce((sum, shipment) => sum + (Number(shipment.shippingCostCents) || 0), 0),
      stripePaymentIntentId: order.stripePaymentIntentId,
      paidAt: toIso(order.paidAt),
      cancelledAt: toIso(order.cancelledAt),
      cancelReason: order.cancelReason || null,
      customerNote: order.customerNote || null,
      adminNote: order.adminNote || null,
      address: {
        id: null,
        label: null,
        recipientName: order.shipRecipientName ?? "",
        phone: order.shipPhone ?? "",
        street: order.shipStreet ?? "",
        exteriorNumber: order.shipExteriorNumber ?? "",
        interiorNumber: order.shipInteriorNumber || null,
        neighborhood: order.shipNeighborhood ?? "",
        city: order.shipCity ?? "",
        stateCode: order.shipStateCode ?? "",
        stateName: storeStateName(order.shipStateCode),
        postalCode: order.shipPostalCode ?? "",
        references: order.shipReferences || null,
        isDefault: false,
      },
      items: lines.map((line) => ({
        ...line,
        variantTitle: line.variantTitle || null,
        sku: line.sku || null,
        coverUrl: line.productId ? covers.get(line.productId)?.url ?? null : null,
      })),
      payments: paymentRows,
      shipments: shipmentRows.map((shipment) => ({
        ...shipment,
        carrier: shipment.carrier || null,
        trackingCode: shipment.trackingCode || null,
        trackingUrl: shipment.trackingUrl || null,
        dropiStatus: shipment.dropiStatus || null,
        lastError: shipment.lastError || null,
        approvedBy: personRef(shipment.approvedBy),
        approvedAt: toIso(shipment.approvedAt),
        shippedAt: toIso(shipment.shippedAt),
        deliveredAt: toIso(shipment.deliveredAt),
      })),
      events: (unwrapPrisma(events) as Array<Record<string, any>>).map((event) => ({
        id: event.id,
        type: event.type,
        message: event.message || null,
        fromStatus: event.fromStatus || null,
        toStatus: event.toStatus || null,
        isPublic: Boolean(event.isPublic),
        actor: personRef(event.actor),
        createdAt: toIso(event.createdAt),
      })),
    };
  },
};

export default { typeDefs, definition, resolver };
