import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../models/Notification/constants";
import {
  STORE_ORDER_EVENT,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
  STORE_PAYMENT_STATUS,
  STORE_TRANSFER_RETRY_HOURS,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { notify } from "../../../../utils/notifications/notify";
import { sendStoreOrderEmail, storeOrderUrl } from "../../../../utils/store/emails";
import {
  addStoreOrderEvent,
  cancelUnpaidStoreOrder,
  markStoreOrderPaid,
  refundStoreOrder,
  updateStoreShipment,
} from "../../../../utils/store/orders";
import { adminPrisma, assertPlatformAdmin } from "../../queries/admin/shared";

/**
 * What an admin does with a store order in Operaciones: confirm or reject a transfer, move a
 * shipment, cancel an unpaid order, refund a paid one and keep an internal note. Every action
 * leaves the admin's name on the order's timeline.
 */

const typeDefs = `
  type AdminStoreActionResult {
    success: Boolean!
    message: String!
  }

  input AdminStoreShipmentInput {
    "pending | pending_approval | requested | label_created | in_transit | delivered | exception | returned | cancelled"
    status: String!
    carrier: String
    trackingCode: String
    "https://…"
    trackingUrl: String
    "What Kadesh paid for this shipment, in MXN cents."
    shippingCostCents: Int
  }
`;

const definition = `
  adminReviewStoreTransfer(orderId: ID!, approve: Boolean!, note: String): AdminStoreActionResult!
  adminUpdateStoreShipment(shipmentId: ID!, input: AdminStoreShipmentInput!): AdminStoreActionResult!
  adminCancelStoreOrder(orderId: ID!, reason: String!): AdminStoreActionResult!
  adminRefundStoreOrder(orderId: ID!, reason: String!, restock: Boolean!): AdminStoreActionResult!
  adminSetStoreOrderNote(orderId: ID!, note: String!): AdminStoreActionResult!
`;

type OrderRef = { id: string; number: string; userId: string | null; status: string; paymentStatus: string; paymentMethod: string };

async function findOrder(context: KeystoneContext, orderId: string): Promise<OrderRef | null> {
  const order = await adminPrisma(context).storeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, userId: true, status: true, paymentStatus: true, paymentMethod: true },
  });
  if (order instanceof Error) throw order;
  return order as OrderRef | null;
}

const resolver = {
  /** Confirms the money of a transfer arrived, or sends the buyer back to upload another proof. */
  adminReviewStoreTransfer: async (
    _root: unknown,
    args: { orderId: string; approve: boolean; note?: string | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const adminId = getSessionUserId(context.session);
    const order = await findOrder(context, args.orderId);
    if (!order) return { success: false, message: "No encontramos el pedido." };
    if (order.paymentMethod !== STORE_PAYMENT_METHOD.TRANSFER) {
      return { success: false, message: "Este pedido no se paga por transferencia." };
    }
    const awaiting = order.paymentStatus === STORE_PAYMENT_STATUS.IN_REVIEW || order.paymentStatus === STORE_PAYMENT_STATUS.PENDING;
    if (order.status !== STORE_ORDER_STATUS.OPEN || !awaiting) {
      return { success: false, message: "Este pedido ya no espera la confirmación de una transferencia." };
    }

    if (args.approve) {
      const result = await markStoreOrderPaid(context, order.id, {
        provider: STORE_PAYMENT_METHOD.TRANSFER,
        reviewedById: adminId,
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_STORE_TRANSFER_REVIEWED,
        summary: `Confirmó la transferencia del pedido ${order.number}`,
        entityType: "StoreOrder",
        entityId: order.id,
        metadata: { approved: true },
      });
      return result === "paid"
        ? { success: true, message: "Transferencia confirmada. El pedido ya está pagado." }
        : { success: false, message: "El pedido ya estaba pagado." };
    }

    const note = (args.note ?? "").trim().slice(0, 300);
    if (!note) return { success: false, message: "Escribe por qué no se pudo confirmar: la persona lo va a leer." };
    const prisma = adminPrisma(context);
    const expiresAt = new Date(Date.now() + STORE_TRANSFER_RETRY_HOURS * 3_600_000);
    const moved = await prisma.storeOrder.updateMany({
      where: { id: order.id, status: STORE_ORDER_STATUS.OPEN, paymentStatus: STORE_PAYMENT_STATUS.IN_REVIEW },
      data: { paymentStatus: STORE_PAYMENT_STATUS.PENDING, expiresAt },
    });
    if (moved instanceof Error) throw moved;
    if (moved.count !== 1) return { success: false, message: "Este pedido no tiene un comprobante en revisión." };
    const payment = await prisma.storePayment.updateMany({
      where: { orderId: order.id, status: STORE_PAYMENT_ATTEMPT_STATUS.IN_REVIEW },
      data: { status: STORE_PAYMENT_ATTEMPT_STATUS.PENDING, errorMessage: note, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (payment instanceof Error) throw payment;

    await addStoreOrderEvent(context, {
      orderId: order.id,
      type: STORE_ORDER_EVENT.TRANSFER_REJECTED,
      actorId: adminId,
      message: `No pudimos confirmar tu transferencia: ${note}`,
      isPublic: true,
      fromStatus: STORE_PAYMENT_STATUS.IN_REVIEW,
      toStatus: STORE_PAYMENT_STATUS.PENDING,
    });
    if (order.userId) {
      void notify(context, {
        audience: [order.userId],
        product: "pet",
        type: NOTIFICATION_TYPE.STORE_TRANSFER_REJECTED,
        title: "No pudimos confirmar tu transferencia",
        body: `${order.number}: ${note}`,
        entityType: "StoreOrder",
        entityId: order.id,
        url: storeOrderUrl(order.number),
      });
    }
    void sendStoreOrderEmail(context, order.id, "transfer_rejected", { note });
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_STORE_TRANSFER_REVIEWED,
      summary: `Rechazó el comprobante del pedido ${order.number}`,
      entityType: "StoreOrder",
      entityId: order.id,
      metadata: { approved: false },
    });
    return { success: true, message: "Comprobante rechazado. Le avisamos a la persona para que suba otro." };
  },

  /** Moves a package: guide, carrier, on its way, delivered. */
  adminUpdateStoreShipment: async (
    _root: unknown,
    args: {
      shipmentId: string;
      input: { status: string; carrier?: string | null; trackingCode?: string | null; trackingUrl?: string | null; shippingCostCents?: number | null };
    },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const result = await updateStoreShipment(context, args.shipmentId, {
      ...args.input,
      actorId: getSessionUserId(context.session),
    });
    if (result.success) {
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_STORE_SHIPMENT_UPDATED,
        summary: `Actualizó un envío de la tienda a "${args.input.status}"`,
        entityType: "StoreShipment",
        entityId: args.shipmentId,
        metadata: { status: args.input.status },
      });
    }
    return result;
  },

  /** Cancels an order nobody paid. A paid one is refunded instead. */
  adminCancelStoreOrder: async (_root: unknown, args: { orderId: string; reason: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const reason = (args.reason ?? "").trim();
    if (!reason) return { success: false, message: "Escribe el motivo: la persona lo va a leer." };
    const order = await findOrder(context, args.orderId);
    if (!order) return { success: false, message: "No encontramos el pedido." };
    if (order.paymentStatus === STORE_PAYMENT_STATUS.PAID) {
      return { success: false, message: "Este pedido está pagado: usa «Reembolsar»." };
    }
    const cancelled = await cancelUnpaidStoreOrder(context, order.id, {
      reason,
      actorId: getSessionUserId(context.session),
      notifyBuyer: true,
    });
    if (!cancelled) return { success: false, message: "El pedido ya estaba cancelado." };
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_STORE_ORDER_CANCELLED,
      summary: `Canceló el pedido ${order.number}`,
      entityType: "StoreOrder",
      entityId: order.id,
    });
    return { success: true, message: "Pedido cancelado. El stock regresó a la tienda." };
  },

  /** Full refund of a paid order (card: through Stripe; transfer: the money is returned by hand). */
  adminRefundStoreOrder: async (
    _root: unknown,
    args: { orderId: string; reason: string; restock: boolean },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const reason = (args.reason ?? "").trim();
    if (!reason) return { success: false, message: "Escribe el motivo: la persona lo va a leer." };
    const result = await refundStoreOrder(context, args.orderId, {
      reason,
      restock: Boolean(args.restock),
      actorId: getSessionUserId(context.session),
    });
    if (result.success) {
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_STORE_ORDER_REFUNDED,
        summary: "Reembolsó un pedido de la tienda",
        entityType: "StoreOrder",
        entityId: args.orderId,
        metadata: { restock: Boolean(args.restock) },
      });
    }
    return result;
  },

  /** Internal note of the order. The buyer never sees it. */
  adminSetStoreOrderNote: async (_root: unknown, args: { orderId: string; note: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const updated = await adminPrisma(context).storeOrder.updateMany({
      where: { id: args.orderId },
      data: { adminNote: (args.note ?? "").trim().slice(0, 2000) },
    });
    if (updated instanceof Error) throw updated;
    return updated.count === 1
      ? { success: true, message: "Nota guardada." }
      : { success: false, message: "No encontramos el pedido." };
  },
};

export default { typeDefs, definition, resolver };
