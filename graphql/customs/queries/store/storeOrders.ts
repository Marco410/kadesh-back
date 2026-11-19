import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_COUPON_ATTEMPTS,
  STORE_ORDERS_DEFAULT_TAKE,
  STORE_ORDERS_MAX_TAKE,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
  STORE_PAYMENT_STATUS,
  STORE_SHIPMENT_STATUS,
  type StoreShipmentStatus,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { requestIp } from "../../../../utils/activity/requestMeta";
import { createRateLimiter } from "../../../../utils/security/rateLimit";
import { toStoreAddress } from "../../../../utils/store/address";
import { loadStoreCovers, storePrisma } from "../../../../utils/store/catalog";
import { storeEnabled } from "../../../../utils/store/config";
import { SHIPMENT_PUBLIC_LABEL } from "../../../../utils/store/orders";
import { publicQuote, quoteCart, type CartItemInput } from "../../../../utils/store/pricing";
import { getStoreSettings, transferInstructions } from "../../../../utils/store/settings";

/**
 * The shopper's side of orders: the cart quote, their orders and their saved addresses. Every
 * answer is built field by field: nothing here returns where a product comes from, what it cost
 * or who fulfils a shipment.
 */

const typeDefs = `
  type StoreOrderSummary {
    number: String!
    createdAt: String
    "open | completed | cancelled"
    status: String!
    "pending | in_review | paid | failed | refunded"
    paymentStatus: String!
    "unfulfilled | partial | shipped | delivered | returned"
    fulfillmentStatus: String!
    "stripe_card | bank_transfer"
    paymentMethod: String!
    totalCents: Int!
    itemsCount: Int!
    firstItemName: String
    coverUrl: String
    "ISO 8601. While unpaid: when it cancels itself."
    expiresAt: String
  }

  type StoreOrdersResult {
    total: Int!
    items: [StoreOrderSummary!]!
  }

  type StoreOrderLine {
    id: ID!
    productId: ID
    "null when the product is no longer for sale"
    productSlug: String
    name: String!
    variantTitle: String
    coverUrl: String
    quantity: Int!
    unitPriceCents: Int!
    totalCents: Int!
  }

  type StoreOrderShipment {
    id: ID!
    "preparing | ready | in_transit | delivered | exception | returned | cancelled"
    status: String!
    statusLabel: String!
    carrier: String
    trackingCode: String
    trackingUrl: String
    shippedAt: String
    deliveredAt: String
    "Names of the products in this package"
    items: [String!]!
  }

  type StoreOrderTimelineEntry {
    type: String!
    message: String!
    createdAt: String
  }

  type StoreOrderDetail {
    summary: StoreOrderSummary!
    subtotalCents: Int!
    shippingCents: Int!
    couponCode: String
    couponDiscountCents: Int!
    customerNote: String
    cancelReason: String
    address: StoreShippingAddress!
    items: [StoreOrderLine!]!
    shipments: [StoreOrderShipment!]!
    timeline: [StoreOrderTimelineEntry!]!
    "Bank data while a transfer is awaited."
    transfer: StoreTransferInstructions
    "A transfer proof is uploaded and waiting for review."
    proofUploaded: Boolean!
    "Why the last proof was not accepted, if it was rejected."
    proofRejectedReason: String
    "The buyer may still cancel it (not paid yet)."
    canCancel: Boolean!
    "Card order still unpaid: the payment can be resumed."
    canPay: Boolean!
    returnPolicy: String
    supportWhatsapp: String
  }
`;

const couponAttempts = createRateLimiter(STORE_COUPON_ATTEMPTS);

const definition = `
  storeCartQuote(items: [StoreCartItemInput!]!, couponCode: String): StoreCartQuote!
  myStoreOrders(take: Int, skip: Int): StoreOrdersResult!
  myStoreOrder(number: String!): StoreOrderDetail
  myStoreAddresses: [StoreShippingAddress!]!
`;

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function iso(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Internal shipment statuses folded into what a buyer needs to know. */
const PUBLIC_SHIPMENT_STATUS: Record<string, string> = {
  [STORE_SHIPMENT_STATUS.PENDING]: "preparing",
  [STORE_SHIPMENT_STATUS.PENDING_APPROVAL]: "preparing",
  [STORE_SHIPMENT_STATUS.REQUESTED]: "preparing",
  [STORE_SHIPMENT_STATUS.LABEL_CREATED]: "ready",
  [STORE_SHIPMENT_STATUS.IN_TRANSIT]: "in_transit",
  [STORE_SHIPMENT_STATUS.DELIVERED]: "delivered",
  [STORE_SHIPMENT_STATUS.EXCEPTION]: "exception",
  [STORE_SHIPMENT_STATUS.RETURNED]: "returned",
  [STORE_SHIPMENT_STATUS.CANCELLED]: "cancelled",
};

const SUMMARY_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  paymentMethod: true,
  totalCents: true,
  unitsCount: true,
  expiresAt: true,
} as const;

type SummaryRow = {
  id: string;
  number: string;
  createdAt: Date | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  totalCents: number;
  unitsCount: number | null;
  expiresAt: Date | null;
};

function toSummary(row: SummaryRow, first: { name: string; coverUrl: string | null } | undefined) {
  return {
    number: row.number,
    createdAt: iso(row.createdAt),
    status: row.status,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    paymentMethod: row.paymentMethod,
    totalCents: row.totalCents,
    itemsCount: Number(row.unitsCount) || 0,
    firstItemName: first?.name ?? null,
    coverUrl: first?.coverUrl ?? null,
    expiresAt: row.paymentStatus === STORE_PAYMENT_STATUS.PENDING && row.status === STORE_ORDER_STATUS.OPEN ? iso(row.expiresAt) : null,
  };
}

const resolver = {
  /** What the cart costs right now. Called when the cart opens or changes, never on a timer. */
  storeCartQuote: async (
    _root: unknown,
    { items, couponCode }: { items: CartItemInput[]; couponCode?: string | null },
    context: KeystoneContext,
  ) => {
    if (!storeEnabled() && !isPlatformAdmin(context.session)) {
      return publicQuote(await quoteCart(context, []));
    }
    const userId = getSessionUserId(context.session);
    const code = (couponCode ?? "").trim();
    if (!code) return publicQuote(await quoteCart(context, items, { userId }));

    // Against guessing codes: only a code that did not apply counts as an attempt (a cart that
    // keeps its coupon is quoted on every change), and past the cap the code is not even looked up.
    const ip = requestIp(context.req) ?? "unknown";
    if (!couponAttempts.peek(ip).ok) {
      const quote = publicQuote(await quoteCart(context, items, { userId }));
      return { ...quote, couponCode: code, couponMessage: "Probaste demasiados cupones. Intenta de nuevo en unos minutos." };
    }
    const quote = await quoteCart(context, items, { couponCode: code, userId });
    if (!quote.couponApplied) couponAttempts.hit(ip);
    return publicQuote(quote);
  },

  /** The buyer's orders, newest first. Four queries whatever the page size. */
  myStoreOrders: async (
    _root: unknown,
    args: { take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { total: 0, items: [] };
    const prisma = storePrisma(context);
    const take = clamp(args.take, 1, STORE_ORDERS_MAX_TAKE, STORE_ORDERS_DEFAULT_TAKE);
    const skip = clamp(args.skip, 0, 100_000, 0);
    const where = { userId };

    const [rows, total] = await Promise.all([
      prisma.storeOrder.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take, skip, select: SUMMARY_SELECT }),
      prisma.storeOrder.count({ where }),
    ]);
    const orders = unwrap(rows) as SummaryRow[];
    if (orders.length === 0) return { total: Number(unwrap(total)) || 0, items: [] };

    // First line of every order in one query, then one for their covers.
    const firsts = await prisma.$queryRaw`
      SELECT DISTINCT ON (i."order") i."order" AS "orderId", i."name", i."product" AS "productId"
      FROM "StoreOrderItem" i
      WHERE i."order" = ANY(${orders.map((order) => order.id)}::text[])
      ORDER BY i."order", i."createdAt" ASC, i."id" ASC
    `;
    const firstRows = unwrap(firsts) as Array<{ orderId: string; name: string; productId: string | null }>;
    const covers = await loadStoreCovers(
      context,
      [...new Set(firstRows.map((row) => row.productId).filter((id): id is string => Boolean(id)))],
    );
    const firstByOrder = new Map(
      firstRows.map((row) => [row.orderId, { name: row.name, coverUrl: row.productId ? covers.get(row.productId)?.url ?? null : null }]),
    );

    return {
      total: Number(unwrap(total)) || 0,
      items: orders.map((order) => toSummary(order, firstByOrder.get(order.id))),
    };
  },

  /** One order of the buyer, with its packages and what has happened to it. */
  myStoreOrder: async (_root: unknown, { number }: { number: string }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    const orderNumber = (number ?? "").trim().toUpperCase();
    if (!userId || !orderNumber) return null;
    const prisma = storePrisma(context);

    const order = unwrap(
      await prisma.storeOrder.findFirst({
        where: { number: orderNumber, userId },
        select: {
          ...SUMMARY_SELECT,
          subtotalCents: true,
          shippingCents: true,
          couponCode: true,
          couponDiscountCents: true,
          customerNote: true,
          cancelReason: true,
          shipRecipientName: true,
          shipPhone: true,
          shipStreet: true,
          shipExteriorNumber: true,
          shipInteriorNumber: true,
          shipNeighborhood: true,
          shipCity: true,
          shipStateCode: true,
          shipPostalCode: true,
          shipReferences: true,
        },
      }),
    ) as (SummaryRow & Record<string, any>) | null;
    if (!order) return null;

    const [items, shipments, events, payments] = await Promise.all([
      prisma.storeOrderItem.findMany({
        where: { orderId: order.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          variantTitle: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
          shipmentId: true,
          productId: true,
          product: { select: { slug: true, status: true } },
        },
      }),
      prisma.storeShipment.findMany({
        where: { orderId: order.id },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, status: true, carrier: true, trackingCode: true, trackingUrl: true, shippedAt: true, deliveredAt: true },
      }),
      prisma.storeOrderEvent.findMany({
        where: { orderId: order.id, isPublic: true },
        orderBy: [{ createdAt: "asc" }],
        take: 60,
        select: { type: true, message: true, createdAt: true },
      }),
      prisma.storePayment.findMany({
        where: { orderId: order.id },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: { status: true, errorMessage: true, transferProof_id: true },
      }),
    ]);
    const lines = unwrap(items) as Array<{
      id: string;
      name: string;
      variantTitle: string | null;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
      shipmentId: string | null;
      productId: string | null;
      product: { slug: string | null; status: string } | null;
    }>;
    const covers = await loadStoreCovers(
      context,
      [...new Set(lines.map((line) => line.productId).filter((id): id is string => Boolean(id)))],
    );
    const settings = await getStoreSettings(context);
    const payment = (unwrap(payments) as Array<{ status: string; errorMessage: string | null; transferProof_id: string | null }>)[0];

    const open = order.status === STORE_ORDER_STATUS.OPEN;
    const unpaid = order.paymentStatus === STORE_PAYMENT_STATUS.PENDING || order.paymentStatus === STORE_PAYMENT_STATUS.FAILED;
    const transfer = order.paymentMethod === STORE_PAYMENT_METHOD.TRANSFER;
    const inReview = order.paymentStatus === STORE_PAYMENT_STATUS.IN_REVIEW;

    return {
      summary: toSummary(order, lines[0] ? { name: lines[0].name, coverUrl: lines[0].productId ? covers.get(lines[0].productId)?.url ?? null : null } : undefined),
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      couponCode: order.couponCode || null,
      couponDiscountCents: Number(order.couponDiscountCents) || 0,
      customerNote: order.customerNote || null,
      cancelReason: order.cancelReason || null,
      address: toStoreAddress(order, "ship"),
      items: lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        productSlug: line.product?.status === "active" ? line.product.slug : null,
        name: line.name,
        variantTitle: line.variantTitle || null,
        coverUrl: line.productId ? covers.get(line.productId)?.url ?? null : null,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        totalCents: line.totalCents,
      })),
      shipments: (unwrap(shipments) as Array<Record<string, any>>).map((shipment) => ({
        id: shipment.id,
        status: PUBLIC_SHIPMENT_STATUS[shipment.status] ?? "preparing",
        statusLabel: SHIPMENT_PUBLIC_LABEL[shipment.status as StoreShipmentStatus] ?? "Preparando tu paquete",
        carrier: shipment.carrier || null,
        trackingCode: shipment.trackingCode || null,
        trackingUrl: shipment.trackingUrl || null,
        shippedAt: iso(shipment.shippedAt),
        deliveredAt: iso(shipment.deliveredAt),
        items: lines.filter((line) => line.shipmentId === shipment.id).map((line) => line.name),
      })),
      timeline: (unwrap(events) as Array<{ type: string; message: string | null; createdAt: Date | null }>).map((event) => ({
        type: event.type,
        message: event.message ?? "",
        createdAt: iso(event.createdAt),
      })),
      transfer:
        open && transfer && (unpaid || inReview)
          ? transferInstructions(settings, { number: order.number, totalCents: order.totalCents, expiresAt: order.expiresAt })
          : null,
      proofUploaded: inReview,
      proofRejectedReason:
        open && transfer && unpaid && payment?.status === STORE_PAYMENT_ATTEMPT_STATUS.PENDING && payment.errorMessage
          ? payment.errorMessage
          : null,
      canCancel: open && (unpaid || inReview),
      canPay: open && unpaid && order.paymentMethod === STORE_PAYMENT_METHOD.CARD,
      returnPolicy: settings.returnPolicy || null,
      supportWhatsapp: settings.supportWhatsapp || null,
    };
  },

  myStoreAddresses: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return [];
    const rows = await storePrisma(context).storeAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      take: 20,
    });
    return (unwrap(rows) as Array<Record<string, any>>).map((row) => toStoreAddress(row));
  },
};

export default { typeDefs, definition, resolver };
