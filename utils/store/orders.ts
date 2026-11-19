import { randomInt } from "crypto";
import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import {
  STORE_FULFILLMENT_STATUS,
  STORE_ORDER_EVENT,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
  STORE_PAYMENT_STATUS,
  STORE_PRODUCT_SOURCE,
  STORE_SHIPMENT_ON_THE_WAY,
  STORE_SHIPMENT_PROVIDER,
  STORE_SHIPMENT_STATUS,
  type StoreShipmentStatus,
} from "../../models/Pet/Store/constants";
import Stripe from "../intregrations/stripe";
import { notify } from "../notifications/notify";
import { pawsOnStorePurchaseUndone, pawsOnStoreShipmentDelivered } from "../pet/pawsTriggers";
import { recomputeStoreProductTotals, storePrisma } from "./catalog";
import { releaseStoreOrderCoupon } from "./coupons";
import { formatStoreMoney, sendStoreOrderEmail, storeOrderUrl } from "./emails";
import type { CartLine } from "./pricing";

/**
 * Life of a store order after the cart: reserving stock, getting paid, cancelling, refunding and
 * shipping. The only code that writes `StoreOrder`, `StorePayment`, `StoreShipment` and
 * `StoreOrderEvent`.
 *
 * There are no interactive transactions here (Keystone's prisma returns errors instead of
 * throwing, and a transaction would hold one of the five pool connections). Each step is a single
 * conditional statement that only one caller can win (`updateMany ... where <previous state>`), so
 * a repeated webhook, a double click or a cron overlapping an admin never applies twice.
 */

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

// No 0/O or 1/I: the number is read aloud and typed as the transfer reference.
const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newStoreOrderNumber(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) code += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  return `KP-${code}`;
}

export function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${(error as any).code ?? ""}` : String(error);
  const prismaCode = (error as any)?.extensions?.prisma?.code ?? (error as any)?.code;
  return prismaCode === "P2002" || /23505|unique constraint|duplicate key/i.test(text);
}

export type StoreOrderEventInput = {
  orderId: string;
  type: string;
  /** Empty = the system (webhook, cron). */
  actorId?: string | null;
  message?: string;
  /** Shown to the buyer in their order. */
  isPublic?: boolean;
  fromStatus?: string;
  toStatus?: string;
  metadata?: Record<string, unknown>;
};

/** Adds a row to the order's timeline. Never throws: the timeline must not break the operation. */
export async function addStoreOrderEvent(context: KeystoneContext, input: StoreOrderEventInput): Promise<void> {
  try {
    const created = await storePrisma(context).storeOrderEvent.create({
      data: {
        order: { connect: { id: input.orderId } },
        type: input.type,
        ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
        message: input.message ?? "",
        isPublic: Boolean(input.isPublic),
        fromStatus: input.fromStatus ?? "",
        toStatus: input.toStatus ?? "",
        metadata: input.metadata ?? undefined,
      },
    });
    if (created instanceof Error) throw created;
  } catch (error) {
    console.error("[store] could not write order event:", input.type, input.orderId, error);
  }
}

// ─── Stock ──────────────────────────────────────────────────────────────────────────────────

type Reserved = { variantId: string; productId: string | null; quantity: number };

async function recomputeProducts(context: KeystoneContext, productIds: Array<string | null | undefined>) {
  for (const productId of new Set(productIds.filter((id): id is string => Boolean(id)))) {
    await recomputeStoreProductTotals(context, productId);
  }
}

/**
 * Takes the stock of every tracked line, one conditional statement per line (`stock >= quantity`),
 * so two orders can never take the same last unit. If a line fails, what was taken goes back and
 * the answer is `null`.
 */
export async function reserveStoreStock(context: KeystoneContext, lines: CartLine[]): Promise<Reserved[] | null> {
  const prisma = storePrisma(context);
  const taken: Reserved[] = [];
  for (const line of lines) {
    if (!line.tracked || line.quantity < 1) continue;
    const rows = await prisma.$queryRaw`
      UPDATE "StoreProductVariant" SET "stock" = "stock" - ${line.quantity}::int
      WHERE "id" = ${line.variantId} AND "stock" >= ${line.quantity}::int
      RETURNING "id"
    `;
    if (rows instanceof Error || (rows as unknown[]).length === 0) {
      await releaseStoreStock(context, taken);
      if (rows instanceof Error) throw rows;
      return null;
    }
    taken.push({ variantId: line.variantId, productId: line.productId, quantity: line.quantity });
  }
  await recomputeProducts(context, taken.map((entry) => entry.productId));
  return taken;
}

/** Gives back stock taken by `reserveStoreStock` when the order could not be created. */
export async function releaseStoreStock(context: KeystoneContext, taken: Reserved[]): Promise<void> {
  const prisma = storePrisma(context);
  for (const entry of taken) {
    const rows = await prisma.$queryRaw`
      UPDATE "StoreProductVariant" SET "stock" = "stock" + ${entry.quantity}::int WHERE "id" = ${entry.variantId} RETURNING "id"
    `;
    if (rows instanceof Error) console.error("[store] could not release stock:", entry.variantId, rows);
  }
  await recomputeProducts(context, taken.map((entry) => entry.productId));
}

/**
 * Returns to the shelves what an order had reserved, in one statement. Idempotent: the lines are
 * zeroed in the same statement, so a second call finds nothing to return.
 */
export async function restoreStoreOrderStock(context: KeystoneContext, orderId: string): Promise<void> {
  const rows = await storePrisma(context).$queryRaw`
    WITH held AS (
      SELECT i."id", i."variant", i."reservedQuantity" AS qty
      FROM "StoreOrderItem" i
      WHERE i."order" = ${orderId} AND i."reservedQuantity" > 0 AND i."variant" IS NOT NULL
      FOR UPDATE
    ),
    zeroed AS (
      UPDATE "StoreOrderItem" i SET "reservedQuantity" = 0 FROM held WHERE i."id" = held."id"
      RETURNING held."variant" AS variant, held.qty AS qty
    )
    UPDATE "StoreProductVariant" v SET "stock" = v."stock" + r.qty
    FROM (SELECT variant, sum(qty)::int AS qty FROM zeroed GROUP BY variant) r
    WHERE v."id" = r.variant
    RETURNING v."product" AS "productId"
  `;
  if (rows instanceof Error) throw rows;
  await recomputeProducts(context, (rows as Array<{ productId: string | null }>).map((row) => row.productId));
}

// ─── Notifications ──────────────────────────────────────────────────────────────────────────

type OrderBrief = { id: string; number: string; userId: string | null; totalCents: number; customerName: string | null };

async function orderBrief(context: KeystoneContext, orderId: string): Promise<OrderBrief | null> {
  const order = await storePrisma(context).storeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, userId: true, totalCents: true, customerName: true },
  });
  if (order instanceof Error) throw order;
  return order as OrderBrief | null;
}

function notifyBuyer(context: KeystoneContext, order: OrderBrief, type: string, title: string, body: string): void {
  if (!order.userId) return;
  void notify(context, {
    audience: [order.userId],
    product: "pet",
    type: type as any,
    title,
    body,
    entityType: "StoreOrder",
    entityId: order.id,
    url: storeOrderUrl(order.number),
  });
}

function notifyAdmins(context: KeystoneContext, order: OrderBrief, type: string, title: string, body: string): void {
  void notify(context, {
    audience: "platform_admins",
    product: "pet",
    type: type as any,
    title,
    body,
    entityType: "StoreOrder",
    entityId: order.id,
    metadata: { orderNumber: order.number },
  });
}

// ─── Paying ─────────────────────────────────────────────────────────────────────────────────

export type MarkPaidInput = {
  provider: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  /** The admin who approved a transfer. */
  reviewedById?: string | null;
};

export type MarkPaidResult = "paid" | "already_paid" | "paid_after_cancel" | "not_found";

const UNPAID = [STORE_PAYMENT_STATUS.PENDING, STORE_PAYMENT_STATUS.IN_REVIEW, STORE_PAYMENT_STATUS.FAILED];
const OPEN_ATTEMPTS = [
  STORE_PAYMENT_ATTEMPT_STATUS.PENDING,
  STORE_PAYMENT_ATTEMPT_STATUS.IN_REVIEW,
  STORE_PAYMENT_ATTEMPT_STATUS.FAILED,
];

async function settlePayment(context: KeystoneContext, orderId: string, input: MarkPaidInput): Promise<void> {
  const updated = await storePrisma(context).storePayment.updateMany({
    where: { orderId, provider: input.provider, status: { in: OPEN_ATTEMPTS } },
    data: {
      status: STORE_PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
      errorMessage: "",
      ...(input.stripeChargeId ? { stripeChargeId: input.stripeChargeId } : {}),
      ...(input.stripePaymentIntentId ? { stripePaymentIntentId: input.stripePaymentIntentId } : {}),
      ...(input.reviewedById ? { reviewedById: input.reviewedById, reviewedAt: new Date() } : {}),
    },
  });
  if (updated instanceof Error) console.error("[store] could not settle payment:", orderId, updated);
}

/** One shipment for what Kadesh ships and one per Dropi supplier. */
async function createShipments(context: KeystoneContext, orderId: string): Promise<void> {
  const prisma = storePrisma(context);
  const items = unwrap(
    await prisma.storeOrderItem.findMany({
      where: { orderId },
      select: { id: true, source: true, dropiSupplierId: true },
    }),
  ) as Array<{ id: string; source: string | null; dropiSupplierId: number | null }>;

  const groups = new Map<string, { provider: string; supplierId: number | null; itemIds: string[] }>();
  for (const item of items) {
    const dropi = item.source === STORE_PRODUCT_SOURCE.DROPI;
    const key = dropi ? `dropi:${item.dropiSupplierId ?? "none"}` : "own";
    const group = groups.get(key) ?? {
      provider: dropi ? STORE_SHIPMENT_PROVIDER.DROPI : STORE_SHIPMENT_PROVIDER.OWN,
      supplierId: dropi ? item.dropiSupplierId : null,
      itemIds: [],
    };
    group.itemIds.push(item.id);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const created = await prisma.storeShipment.create({
      data: {
        order: { connect: { id: orderId } },
        provider: group.provider,
        status:
          group.provider === STORE_SHIPMENT_PROVIDER.DROPI
            ? STORE_SHIPMENT_STATUS.PENDING_APPROVAL
            : STORE_SHIPMENT_STATUS.PENDING,
        dropiSupplierId: group.supplierId,
        items: { connect: group.itemIds.map((id) => ({ id })) },
      },
    });
    if (created instanceof Error) throw created;
  }
}

async function bumpSalesCount(context: KeystoneContext, orderId: string, sign: 1 | -1): Promise<void> {
  const rows = await storePrisma(context).$queryRaw`
    UPDATE "StoreProduct" p SET "salesCount" = GREATEST(0, COALESCE(p."salesCount", 0) + ${sign}::int * s.qty)
    FROM (
      SELECT i."product" AS product, sum(i."quantity")::int AS qty
      FROM "StoreOrderItem" i WHERE i."order" = ${orderId} AND i."product" IS NOT NULL GROUP BY i."product"
    ) s
    WHERE p."id" = s.product
    RETURNING p."id"
  `;
  if (rows instanceof Error) console.error("[store] could not update sales count:", orderId, rows);
}

/**
 * The money of an order arrived (Stripe webhook, or an admin approving a transfer). Only the first
 * call moves the order to paid; later ones answer `already_paid`.
 */
export async function markStoreOrderPaid(
  context: KeystoneContext,
  orderId: string,
  input: MarkPaidInput,
): Promise<MarkPaidResult> {
  const prisma = storePrisma(context);
  const claimed = unwrap(
    await prisma.storeOrder.updateMany({
      where: { id: orderId, status: STORE_ORDER_STATUS.OPEN, paymentStatus: { in: UNPAID } },
      data: { paymentStatus: STORE_PAYMENT_STATUS.PAID, paidAt: new Date(), expiresAt: null },
    }),
  ) as { count: number };

  if (claimed.count !== 1) {
    // Money for an order that was already cancelled (it expired while the bank was confirming).
    const late = unwrap(
      await prisma.storeOrder.updateMany({
        where: { id: orderId, status: STORE_ORDER_STATUS.CANCELLED, paymentStatus: { in: UNPAID } },
        data: { paymentStatus: STORE_PAYMENT_STATUS.PAID, paidAt: new Date() },
      }),
    ) as { count: number };
    if (late.count === 1) {
      const order = await orderBrief(context, orderId);
      // The attempt was closed as cancelled when the order was: reopen it to record the money.
      const reopened = await prisma.storePayment.updateMany({
        where: { orderId, provider: input.provider, status: STORE_PAYMENT_ATTEMPT_STATUS.CANCELLED },
        data: { status: STORE_PAYMENT_ATTEMPT_STATUS.PENDING },
      });
      if (reopened instanceof Error) console.error("[store] could not reopen payment:", orderId, reopened);
      await settlePayment(context, orderId, input);
      await addStoreOrderEvent(context, {
        orderId,
        type: STORE_ORDER_EVENT.PAID_AFTER_CANCEL,
        message: "Llegó el pago de un pedido que ya estaba cancelado. Hay que reembolsarlo.",
      });
      if (order) {
        notifyAdmins(
          context,
          order,
          NOTIFICATION_TYPE.STORE_ADMIN_PAID_AFTER_CANCEL,
          `Pago de un pedido cancelado: ${order.number}`,
          `Llegaron ${formatStoreMoney(order.totalCents)} de un pedido que ya se había cancelado. Hay que reembolsarlo.`,
        );
      }
      return "paid_after_cancel";
    }
    const exists = unwrap(await prisma.storeOrder.findUnique({ where: { id: orderId }, select: { id: true } }));
    return exists ? "already_paid" : "not_found";
  }

  await settlePayment(context, orderId, input);
  await createShipments(context, orderId);
  await bumpSalesCount(context, orderId, 1);
  await addStoreOrderEvent(context, {
    orderId,
    type: STORE_ORDER_EVENT.PAID,
    actorId: input.reviewedById ?? null,
    message: input.provider === STORE_PAYMENT_METHOD.TRANSFER ? "Confirmamos tu transferencia." : "Recibimos tu pago.",
    isPublic: true,
    toStatus: STORE_PAYMENT_STATUS.PAID,
  });

  const order = await orderBrief(context, orderId);
  if (order) {
    notifyBuyer(
      context,
      order,
      NOTIFICATION_TYPE.STORE_ORDER_PAID,
      "Recibimos tu pago",
      `Tu pedido ${order.number} está pagado y lo estamos preparando.`,
    );
    notifyAdmins(
      context,
      order,
      NOTIFICATION_TYPE.STORE_ADMIN_ORDER_PAID,
      `Pedido pagado: ${order.number}`,
      `${order.customerName || "Alguien"} pagó ${formatStoreMoney(order.totalCents)}. Falta surtirlo.`,
    );
  }
  void sendStoreOrderEmail(context, orderId, "paid");
  return "paid";
}

// ─── Cancelling ─────────────────────────────────────────────────────────────────────────────

export type CancelInput = {
  reason: string;
  /** `expired` (cron) or `cancelled`. */
  eventType?: string;
  /** Empty = the system. */
  actorId?: string | null;
  /** Email the buyer (not when they cancelled it themselves). */
  notifyBuyer?: boolean;
};

/**
 * Cancels an order that was never paid: gives the stock back, closes the Stripe PaymentIntent and
 * the pending payment. `false` when there was nothing to cancel (already paid or cancelled).
 */
export async function cancelUnpaidStoreOrder(context: KeystoneContext, orderId: string, input: CancelInput): Promise<boolean> {
  const prisma = storePrisma(context);
  const claimed = unwrap(
    await prisma.storeOrder.updateMany({
      where: { id: orderId, status: STORE_ORDER_STATUS.OPEN, paymentStatus: { in: UNPAID } },
      data: {
        status: STORE_ORDER_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason.slice(0, 300),
        expiresAt: null,
      },
    }),
  ) as { count: number };
  if (claimed.count !== 1) return false;

  await restoreStoreOrderStock(context, orderId);
  await releaseStoreOrderCoupon(context, orderId);

  const order = unwrap(
    await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { id: true, number: true, userId: true, totalCents: true, customerName: true, stripePaymentIntentId: true },
    }),
  ) as (OrderBrief & { stripePaymentIntentId: string | null }) | null;

  if (order?.stripePaymentIntentId) {
    try {
      await Stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    } catch (error) {
      // Already cancelled, or already paid: a paid one comes back through the webhook.
      console.warn("[store] could not cancel PaymentIntent:", order.stripePaymentIntentId, (error as Error)?.message);
    }
  }
  const payments = await prisma.storePayment.updateMany({
    where: { orderId, status: { in: OPEN_ATTEMPTS } },
    data: { status: STORE_PAYMENT_ATTEMPT_STATUS.CANCELLED },
  });
  if (payments instanceof Error) console.error("[store] could not close payments:", orderId, payments);

  await addStoreOrderEvent(context, {
    orderId,
    type: input.eventType ?? STORE_ORDER_EVENT.CANCELLED,
    actorId: input.actorId ?? null,
    message: input.reason,
    isPublic: true,
    toStatus: STORE_ORDER_STATUS.CANCELLED,
  });

  if (order && input.notifyBuyer) {
    notifyBuyer(context, order, NOTIFICATION_TYPE.STORE_ORDER_CANCELLED, "Tu pedido se canceló", `${order.number}: ${input.reason}`);
    void sendStoreOrderEmail(context, orderId, "cancelled", { note: input.reason });
  }
  return true;
}

// ─── Refunding ──────────────────────────────────────────────────────────────────────────────

export type RefundInput = {
  reason: string;
  actorId?: string | null;
  /** Put the products back on the shelves. */
  restock: boolean;
  /** The refund was already made on Stripe (dashboard): do not ask Stripe again. */
  alreadyRefundedOnStripe?: boolean;
  stripeRefundId?: string | null;
};

export type RefundResult = { success: boolean; message: string };

/**
 * Full refund of a paid order: the money goes back (card: through Stripe; transfer: the team
 * returns it by hand), the order is cancelled and what has not been delivered is not shipped.
 */
export async function refundStoreOrder(context: KeystoneContext, orderId: string, input: RefundInput): Promise<RefundResult> {
  const prisma = storePrisma(context);
  const order = unwrap(
    await prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        userId: true,
        totalCents: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        stripePaymentIntentId: true,
      },
    }),
  ) as (OrderBrief & { status: string; paymentStatus: string; paymentMethod: string; stripePaymentIntentId: string | null }) | null;
  if (!order) return { success: false, message: "No encontramos el pedido." };
  if (order.paymentStatus === STORE_PAYMENT_STATUS.REFUNDED) return { success: false, message: "Este pedido ya está reembolsado." };
  if (order.paymentStatus !== STORE_PAYMENT_STATUS.PAID) return { success: false, message: "Este pedido no está pagado." };

  let stripeRefundId = input.stripeRefundId ?? null;
  const card = order.paymentMethod === STORE_PAYMENT_METHOD.CARD;
  if (card && !input.alreadyRefundedOnStripe) {
    if (!order.stripePaymentIntentId) return { success: false, message: "El pedido no tiene un cobro de Stripe que reembolsar." };
    try {
      const refund = await Stripe.refunds.create(
        { payment_intent: order.stripePaymentIntentId, reason: "requested_by_customer", metadata: { kind: "store_order", orderId } },
        { idempotencyKey: `store-refund-${orderId}` },
      );
      stripeRefundId = refund?.id ?? null;
    } catch (error) {
      console.error("[store] Stripe refund failed:", orderId, error);
      return { success: false, message: "Stripe no pudo hacer el reembolso. Revisa el cobro en Stripe e intenta de nuevo." };
    }
  }

  const claimed = unwrap(
    await prisma.storeOrder.updateMany({
      where: { id: orderId, paymentStatus: STORE_PAYMENT_STATUS.PAID },
      data: {
        paymentStatus: STORE_PAYMENT_STATUS.REFUNDED,
        status: STORE_ORDER_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason.slice(0, 300),
      },
    }),
  ) as { count: number };
  if (claimed.count !== 1) return { success: true, message: "El pedido ya estaba reembolsado." };

  const payments = await prisma.storePayment.updateMany({
    where: { orderId, status: STORE_PAYMENT_ATTEMPT_STATUS.SUCCEEDED },
    data: { status: STORE_PAYMENT_ATTEMPT_STATUS.REFUNDED, refundedCents: order.totalCents, stripeRefundId },
  });
  if (payments instanceof Error) console.error("[store] could not mark payment refunded:", orderId, payments);

  const shipments = await prisma.storeShipment.updateMany({
    where: { orderId, status: { notIn: [STORE_SHIPMENT_STATUS.DELIVERED, STORE_SHIPMENT_STATUS.RETURNED] } },
    data: { status: STORE_SHIPMENT_STATUS.CANCELLED },
  });
  if (shipments instanceof Error) console.error("[store] could not cancel shipments:", orderId, shipments);

  if (input.restock) await restoreStoreOrderStock(context, orderId);
  await bumpSalesCount(context, orderId, -1);
  await releaseStoreOrderCoupon(context, orderId);
  // The paws earned by this purchase go back with the money.
  void pawsOnStorePurchaseUndone(context, { orderId });

  await addStoreOrderEvent(context, {
    orderId,
    type: STORE_ORDER_EVENT.REFUNDED,
    actorId: input.actorId ?? null,
    message: card
      ? `Reembolsamos ${formatStoreMoney(order.totalCents)} a tu tarjeta.`
      : `Reembolso de ${formatStoreMoney(order.totalCents)} por transferencia.`,
    isPublic: true,
    toStatus: STORE_PAYMENT_STATUS.REFUNDED,
    metadata: { reason: input.reason, restock: input.restock, stripeRefundId },
  });
  notifyBuyer(
    context,
    order,
    NOTIFICATION_TYPE.STORE_ORDER_CANCELLED,
    "Reembolsamos tu pedido",
    `${order.number}: te devolvimos ${formatStoreMoney(order.totalCents)}.`,
  );
  void sendStoreOrderEmail(context, orderId, "refunded", { note: input.reason });

  return {
    success: true,
    message: card
      ? "Pedido reembolsado en Stripe y cancelado."
      : "Pedido cancelado. Falta devolver la transferencia a la persona: eso se hace desde el banco.",
  };
}

// ─── Shipping ───────────────────────────────────────────────────────────────────────────────

/** What the order as a whole looks like from its shipments (cancelled ones do not count). */
export function fulfillmentFromShipments(statuses: string[]): string {
  const live = statuses.filter((status) => status !== STORE_SHIPMENT_STATUS.CANCELLED);
  if (live.length === 0) return STORE_FULFILLMENT_STATUS.UNFULFILLED;
  const delivered = live.filter((status) => status === STORE_SHIPMENT_STATUS.DELIVERED).length;
  const returned = live.filter((status) => status === STORE_SHIPMENT_STATUS.RETURNED).length;
  const moving = live.filter((status) => STORE_SHIPMENT_ON_THE_WAY.includes(status)).length;
  if (delivered === live.length) return STORE_FULFILLMENT_STATUS.DELIVERED;
  if (returned === live.length) return STORE_FULFILLMENT_STATUS.RETURNED;
  if (delivered + moving === live.length) return STORE_FULFILLMENT_STATUS.SHIPPED;
  if (delivered + moving > 0) return STORE_FULFILLMENT_STATUS.PARTIAL;
  return STORE_FULFILLMENT_STATUS.UNFULFILLED;
}

/** Recomputes `fulfillmentStatus` (and completes the order when everything was delivered). */
export async function recomputeStoreFulfillment(context: KeystoneContext, orderId: string): Promise<string> {
  const prisma = storePrisma(context);
  const shipments = unwrap(
    await prisma.storeShipment.findMany({ where: { orderId }, select: { status: true } }),
  ) as Array<{ status: string }>;
  const next = fulfillmentFromShipments(shipments.map((shipment) => shipment.status));
  const changed = unwrap(
    await prisma.storeOrder.updateMany({
      where: { id: orderId, fulfillmentStatus: { not: next } },
      data: { fulfillmentStatus: next },
    }),
  ) as { count: number };
  if (changed.count === 1 && next === STORE_FULFILLMENT_STATUS.DELIVERED) {
    const completed = unwrap(
      await prisma.storeOrder.updateMany({
        where: { id: orderId, status: STORE_ORDER_STATUS.OPEN, paymentStatus: STORE_PAYMENT_STATUS.PAID },
        data: { status: STORE_ORDER_STATUS.COMPLETED },
      }),
    ) as { count: number };
    if (completed.count === 1) {
      await addStoreOrderEvent(context, {
        orderId,
        type: STORE_ORDER_EVENT.COMPLETED,
        message: "Entregamos todo tu pedido.",
        isPublic: true,
        toStatus: STORE_ORDER_STATUS.COMPLETED,
      });
      const order = await orderBrief(context, orderId);
      if (order) {
        // The one invitation to review: sent once, when the whole order has arrived.
        notifyBuyer(
          context,
          order,
          NOTIFICATION_TYPE.STORE_ORDER_DELIVERED,
          "Tu pedido llegó",
          `Entregamos tu pedido ${order.number}. Cuéntanos qué te parecieron tus productos.`,
        );
      }
      void sendStoreOrderEmail(context, orderId, "delivered");
    }
  }
  return next;
}

export type ShipmentUpdate = {
  status: string;
  carrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  shippingCostCents?: number | null;
  actorId?: string | null;
};

const SHIPMENT_STATUSES = new Set<string>(Object.values(STORE_SHIPMENT_STATUS));

/** What a buyer reads for each shipment status. Never mentions who fulfils it. */
export const SHIPMENT_PUBLIC_LABEL: Record<StoreShipmentStatus, string> = {
  pending: "Preparando tu paquete",
  pending_approval: "Preparando tu paquete",
  requested: "Preparando tu paquete",
  label_created: "Listo para salir",
  in_transit: "En camino",
  delivered: "Entregado",
  exception: "Con un contratiempo",
  returned: "Devuelto",
  cancelled: "Cancelado",
};

/**
 * Moves a shipment (an admin today; the Dropi sync later). Tells the buyer the first time it
 * leaves, and recomputes the order's fulfillment.
 */
export async function updateStoreShipment(
  context: KeystoneContext,
  shipmentId: string,
  input: ShipmentUpdate,
): Promise<{ success: boolean; message: string }> {
  if (!SHIPMENT_STATUSES.has(input.status)) return { success: false, message: "Estatus de envío no válido." };
  const prisma = storePrisma(context);
  const shipment = unwrap(
    await prisma.storeShipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        orderId: true,
        shippedAt: true,
        deliveredAt: true,
        carrier: true,
        trackingCode: true,
        trackingUrl: true,
        order: { select: { paymentStatus: true, status: true } },
      },
    }),
  ) as {
    id: string;
    status: string;
    orderId: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    carrier: string | null;
    trackingCode: string | null;
    trackingUrl: string | null;
    order: { paymentStatus: string; status: string } | null;
  } | null;
  if (!shipment?.orderId || !shipment.order) return { success: false, message: "No encontramos el envío." };
  if (shipment.order.paymentStatus !== STORE_PAYMENT_STATUS.PAID) {
    return { success: false, message: "El pedido de este envío no está pagado." };
  }

  const trackingUrl = (input.trackingUrl ?? shipment.trackingUrl ?? "").trim();
  if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) {
    return { success: false, message: "El enlace de rastreo debe empezar con https://." };
  }
  const carrier = (input.carrier ?? shipment.carrier ?? "").trim();
  const trackingCode = (input.trackingCode ?? shipment.trackingCode ?? "").trim();
  const leaving = STORE_SHIPMENT_ON_THE_WAY.includes(input.status) || input.status === STORE_SHIPMENT_STATUS.DELIVERED;
  const firstTimeOut = leaving && !shipment.shippedAt;
  const now = new Date();

  const updated = await prisma.storeShipment.update({
    where: { id: shipmentId },
    data: {
      status: input.status,
      carrier,
      trackingCode,
      trackingUrl,
      ...(typeof input.shippingCostCents === "number" ? { shippingCostCents: Math.max(0, Math.floor(input.shippingCostCents)) } : {}),
      ...(firstTimeOut ? { shippedAt: now } : {}),
      ...(input.status === STORE_SHIPMENT_STATUS.DELIVERED && !shipment.deliveredAt ? { deliveredAt: now } : {}),
    },
  });
  if (updated instanceof Error) throw updated;

  const statusChanged = shipment.status !== input.status;
  if (statusChanged || firstTimeOut) {
    await addStoreOrderEvent(context, {
      orderId: shipment.orderId,
      type: firstTimeOut ? STORE_ORDER_EVENT.SHIPPED : STORE_ORDER_EVENT.SHIPMENT_UPDATED,
      actorId: input.actorId ?? null,
      message: `${SHIPMENT_PUBLIC_LABEL[input.status as StoreShipmentStatus]}${
        firstTimeOut && trackingCode ? `. Guía ${trackingCode}${carrier ? ` (${carrier})` : ""}` : ""
      }`,
      isPublic: true,
      fromStatus: shipment.status,
      toStatus: input.status,
      metadata: { shipmentId },
    });
  }

  if (firstTimeOut && input.status !== STORE_SHIPMENT_STATUS.DELIVERED) {
    const order = await orderBrief(context, shipment.orderId);
    if (order) {
      notifyBuyer(
        context,
        order,
        NOTIFICATION_TYPE.STORE_ORDER_SHIPPED,
        "Tu pedido va en camino",
        trackingCode ? `${order.number}: guía ${trackingCode}${carrier ? ` (${carrier})` : ""}.` : `Un paquete de ${order.number} ya salió.`,
      );
    }
    void sendStoreOrderEmail(context, shipment.orderId, "shipped", { carrier, trackingCode, trackingUrl });
  }

  // The package was delivered: its products earn paws for the buyer (once per order line, however
  // many times it is marked). It came back: they are taken away.
  if (statusChanged && input.status === STORE_SHIPMENT_STATUS.DELIVERED) {
    void pawsOnStoreShipmentDelivered(context, shipmentId);
  } else if (statusChanged && input.status === STORE_SHIPMENT_STATUS.RETURNED) {
    void pawsOnStorePurchaseUndone(context, { shipmentId });
  }

  await recomputeStoreFulfillment(context, shipment.orderId);
  return { success: true, message: "Envío actualizado." };
}

/**
 * Asks Stripe whether the card payment of an unpaid order already went through and, if so, marks
 * the order paid right away. The webhook normally does it, but it can arrive seconds later (or
 * never, locally without `stripe listen`): the buyer must not see "sin pagar" after paying.
 * `true` when the order is paid now.
 */
export async function settleStoreCardPayment(
  context: KeystoneContext,
  order: { id: string; stripePaymentIntentId: string | null },
): Promise<boolean> {
  if (!order.stripePaymentIntentId) return false;
  const intent = await Stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
  if (intent.status !== "succeeded") return false;
  const result = await markStoreOrderPaid(context, order.id, {
    provider: STORE_PAYMENT_METHOD.CARD,
    stripePaymentIntentId: intent.id,
    stripeChargeId: typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null,
  });
  return result === "paid" || result === "already_paid";
}
