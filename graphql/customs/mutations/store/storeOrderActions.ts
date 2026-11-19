import { Readable } from "stream";
import type { KeystoneContext } from "@keystone-6/core/types";
import { imageSize } from "image-size";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../models/Notification/constants";
import {
  STORE_ADDRESS_MAX,
  STORE_EXPIRE_MAX_PER_RUN,
  STORE_ORDER_EVENT,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
  STORE_PAYMENT_STATUS,
  STORE_TRANSFER_PROOF_MAX_BYTES,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import Stripe from "../../../../utils/intregrations/stripe";
import { notify } from "../../../../utils/notifications/notify";
import { toStoreAddress, validateStoreAddress, type StoreAddressInput } from "../../../../utils/store/address";
import { storePrisma } from "../../../../utils/store/catalog";
import { addStoreOrderEvent, cancelUnpaidStoreOrder, markStoreOrderPaid, settleStoreCardPayment } from "../../../../utils/store/orders";

/**
 * What a buyer does with an order after placing it (upload the transfer proof, resume a card
 * payment, cancel it), their saved addresses, and the cron that cancels unpaid orders.
 */

const typeDefs = `
  type StoreOrderActionResult {
    success: Boolean!
    message: String!
  }

  type StoreOrderPaymentResult {
    success: Boolean!
    message: String!
    "Confirm this with Stripe Elements."
    stripeClientSecret: String
    totalCents: Int
  }

  type StoreShippingAddressResult {
    success: Boolean!
    message: String!
    address: StoreShippingAddress
  }

  type ExpireStoreOrdersResult {
    success: Boolean!
    message: String!
    checked: Int!
    cancelled: Int!
    paid: Int!
  }
`;

const definition = `
  uploadStoreTransferProof(orderNumber: String!, file: Upload!, reference: String): StoreOrderActionResult!
  resumeStoreOrderPayment(orderNumber: String!): StoreOrderPaymentResult!
  cancelMyStoreOrder(orderNumber: String!): StoreOrderActionResult!
  saveMyStoreAddress(id: ID, input: StoreShippingAddressInput!, isDefault: Boolean): StoreShippingAddressResult!
  deleteMyStoreAddress(id: ID!): StoreOrderActionResult!
  expireStoreOrders(secret: String!): ExpireStoreOrdersResult!
`;

type UploadValue = { filename?: string; createReadStream: () => NodeJS.ReadableStream };

type OwnOrder = {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalCents: number;
  stripePaymentIntentId: string | null;
};

async function findOwnOrder(context: KeystoneContext, userId: string, orderNumber: string): Promise<OwnOrder | null> {
  const order = await storePrisma(context).storeOrder.findFirst({
    where: { number: (orderNumber ?? "").trim().toUpperCase(), userId },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      totalCents: true,
      stripePaymentIntentId: true,
    },
  });
  if (order instanceof Error) throw order;
  return order as OwnOrder | null;
}

/** Reads an upload into memory, refusing it as soon as it passes the size cap. */
async function readCapped(stream: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > maxBytes) {
      (stream as any).destroy?.();
      return null;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

const resolver = {
  /** The buyer uploads the proof of their transfer: the order waits for an admin to confirm it. */
  uploadStoreTransferProof: async (
    _root: unknown,
    args: { orderNumber: string; file: Promise<UploadValue>; reference?: string | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para subir tu comprobante." };
    try {
      const order = await findOwnOrder(context, userId, args.orderNumber);
      if (!order) return { success: false, message: "No encontramos ese pedido." };
      if (order.paymentMethod !== STORE_PAYMENT_METHOD.TRANSFER) {
        return { success: false, message: "Este pedido no se paga por transferencia." };
      }
      const awaiting = order.paymentStatus === STORE_PAYMENT_STATUS.PENDING || order.paymentStatus === STORE_PAYMENT_STATUS.IN_REVIEW;
      if (order.status !== STORE_ORDER_STATUS.OPEN || !awaiting) {
        return { success: false, message: "Este pedido ya no espera un comprobante." };
      }

      const upload = await args.file;
      const buffer = await readCapped(upload.createReadStream(), STORE_TRANSFER_PROOF_MAX_BYTES);
      if (!buffer) return { success: false, message: "El comprobante debe pesar menos de 8 MB." };
      let type: string | undefined;
      try {
        type = imageSize(buffer).type;
      } catch {
        type = undefined;
      }
      if (type !== "jpg" && type !== "png" && type !== "webp") {
        return { success: false, message: "Sube una foto o captura de tu comprobante (JPG, PNG o WEBP)." };
      }
      const stored = (await context.images("s3_store").getDataFromStream(Readable.from(buffer), `comprobante.${type}`)) as {
        id: string;
        extension: string;
        filesize: number;
        width: number;
        height: number;
      };

      const prisma = storePrisma(context);
      const payment = await prisma.storePayment.updateMany({
        where: {
          orderId: order.id,
          provider: STORE_PAYMENT_METHOD.TRANSFER,
          status: { in: [STORE_PAYMENT_ATTEMPT_STATUS.PENDING, STORE_PAYMENT_ATTEMPT_STATUS.IN_REVIEW] },
        },
        data: {
          status: STORE_PAYMENT_ATTEMPT_STATUS.IN_REVIEW,
          transferProof_id: stored.id,
          transferProof_extension: stored.extension,
          transferProof_filesize: stored.filesize,
          transferProof_width: stored.width,
          transferProof_height: stored.height,
          transferReference: (args.reference ?? "").trim().slice(0, 80),
          errorMessage: "",
        },
      });
      if (payment instanceof Error) throw payment;
      // With a proof in review the order no longer expires on its own.
      const moved = await prisma.storeOrder.updateMany({
        where: { id: order.id, status: STORE_ORDER_STATUS.OPEN, paymentStatus: { in: [STORE_PAYMENT_STATUS.PENDING, STORE_PAYMENT_STATUS.IN_REVIEW] } },
        data: { paymentStatus: STORE_PAYMENT_STATUS.IN_REVIEW, expiresAt: null },
      });
      if (moved instanceof Error) throw moved;
      if (moved.count !== 1) return { success: false, message: "Este pedido ya no espera un comprobante." };

      await addStoreOrderEvent(context, {
        orderId: order.id,
        type: STORE_ORDER_EVENT.TRANSFER_PROOF_UPLOADED,
        actorId: userId,
        message: "Subiste tu comprobante. Lo revisamos en horario laboral.",
        isPublic: true,
        toStatus: STORE_PAYMENT_STATUS.IN_REVIEW,
      });
      void notify(context, {
        audience: "platform_admins",
        product: "pet",
        type: NOTIFICATION_TYPE.STORE_ADMIN_TRANSFER_REVIEW,
        title: `Comprobante por revisar: ${order.number}`,
        body: "Una persona subió el comprobante de su transferencia.",
        entityType: "StoreOrder",
        entityId: order.id,
        metadata: { orderNumber: order.number },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_STORE_TRANSFER_PROOF_UPLOADED,
        summary: `Subió el comprobante del pedido ${order.number}`,
        entityType: "StoreOrder",
        entityId: order.id,
      });
      return { success: true, message: "Recibimos tu comprobante. Te avisamos en cuanto lo confirmemos." };
    } catch (error) {
      console.error("[uploadStoreTransferProof]", error);
      return { success: false, message: "No pudimos subir tu comprobante. Intenta de nuevo." };
    }
  },

  /** Card order still unpaid (the page was closed, the card failed): hands back its PaymentIntent. */
  resumeStoreOrderPayment: async (_root: unknown, { orderNumber }: { orderNumber: string }, context: KeystoneContext) => {
    const empty = { stripeClientSecret: null, totalCents: null };
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para pagar tu pedido.", ...empty };
    try {
      const order = await findOwnOrder(context, userId, orderNumber);
      if (!order) return { success: false, message: "No encontramos ese pedido.", ...empty };
      const unpaid = order.paymentStatus === STORE_PAYMENT_STATUS.PENDING || order.paymentStatus === STORE_PAYMENT_STATUS.FAILED;
      if (order.status !== STORE_ORDER_STATUS.OPEN || !unpaid || order.paymentMethod !== STORE_PAYMENT_METHOD.CARD || !order.stripePaymentIntentId) {
        return { success: false, message: "Este pedido ya no se puede pagar con tarjeta.", ...empty };
      }
      // The webhook may be late: if Stripe already charged it, the order is paid now.
      if (await settleStoreCardPayment(context, { id: order.id, stripePaymentIntentId: order.stripePaymentIntentId })) {
        return { success: true, message: "Tu pago ya se había recibido. Tu pedido está pagado.", ...empty };
      }
      const intent = await Stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      if (intent.status === "canceled" || !intent.client_secret) {
        return { success: false, message: "Este cobro ya venció. Haz el pedido de nuevo.", ...empty };
      }
      return { success: true, message: "Listo para pagar.", stripeClientSecret: intent.client_secret, totalCents: order.totalCents };
    } catch (error) {
      console.error("[resumeStoreOrderPayment]", error);
      return { success: false, message: "No pudimos preparar el pago. Intenta de nuevo.", ...empty };
    }
  },

  /** The buyer cancels an order they have not paid. */
  cancelMyStoreOrder: async (_root: unknown, { orderNumber }: { orderNumber: string }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para cancelar tu pedido." };
    try {
      const order = await findOwnOrder(context, userId, orderNumber);
      if (!order) return { success: false, message: "No encontramos ese pedido." };
      const cancelled = await cancelUnpaidStoreOrder(context, order.id, {
        reason: "Lo cancelaste antes de pagar.",
        actorId: userId,
      });
      if (!cancelled) {
        return { success: false, message: "Este pedido ya está pagado o cancelado. Si necesitas ayuda, escríbenos." };
      }
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_STORE_ORDER_CANCELLED,
        summary: `Canceló el pedido ${order.number}`,
        entityType: "StoreOrder",
        entityId: order.id,
      });
      return { success: true, message: "Cancelamos tu pedido. No se hizo ningún cobro." };
    } catch (error) {
      console.error("[cancelMyStoreOrder]", error);
      return { success: false, message: "No pudimos cancelar tu pedido. Intenta de nuevo." };
    }
  },

  saveMyStoreAddress: async (
    _root: unknown,
    args: { id?: string | null; input: StoreAddressInput; isDefault?: boolean | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para guardar tu dirección.", address: null };
    const checked = validateStoreAddress(args.input);
    if (!checked.ok) return { success: false, message: checked.message, address: null };
    try {
      const prisma = storePrisma(context);
      const mine = await prisma.storeAddress.findMany({ where: { userId }, select: { id: true }, take: STORE_ADDRESS_MAX + 1 });
      if (mine instanceof Error) throw mine;
      const ids = (mine as Array<{ id: string }>).map((row) => row.id);
      if (args.id && !ids.includes(args.id)) return { success: false, message: "No encontramos esa dirección.", address: null };
      if (!args.id && ids.length >= STORE_ADDRESS_MAX) {
        return { success: false, message: `Puedes guardar hasta ${STORE_ADDRESS_MAX} direcciones. Borra una para agregar otra.`, address: null };
      }
      const makeDefault = Boolean(args.isDefault) || ids.length === 0;
      if (makeDefault) {
        const cleared = await prisma.storeAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
        if (cleared instanceof Error) throw cleared;
      }
      const saved = args.id
        ? await prisma.storeAddress.update({ where: { id: args.id }, data: { ...checked.data, ...(makeDefault ? { isDefault: true } : {}) } })
        : await prisma.storeAddress.create({ data: { ...checked.data, isDefault: makeDefault, user: { connect: { id: userId } } } });
      if (saved instanceof Error) throw saved;
      return { success: true, message: "Dirección guardada.", address: toStoreAddress(saved as Record<string, any>) };
    } catch (error) {
      console.error("[saveMyStoreAddress]", error);
      return { success: false, message: "No pudimos guardar tu dirección. Intenta de nuevo.", address: null };
    }
  },

  deleteMyStoreAddress: async (_root: unknown, { id }: { id: string }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para borrar tu dirección." };
    try {
      const removed = await storePrisma(context).storeAddress.deleteMany({ where: { id, userId } });
      if (removed instanceof Error) throw removed;
      return removed.count === 1
        ? { success: true, message: "Dirección borrada." }
        : { success: false, message: "No encontramos esa dirección." };
    } catch (error) {
      console.error("[deleteMyStoreAddress]", error);
      return { success: false, message: "No pudimos borrar tu dirección. Intenta de nuevo." };
    }
  },

  /**
   * Cron (GitHub Actions, every hour): cancels the orders nobody paid in time and puts their stock
   * back. A card order is checked with Stripe first: if the charge went through and only the
   * webhook is missing, it is marked as paid instead.
   */
  expireStoreOrders: async (_root: unknown, { secret }: { secret: string }, context: KeystoneContext) => {
    const empty = { checked: 0, cancelled: 0, paid: 0 };
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) return { success: false, message: "No autorizado.", ...empty };

    const prisma = storePrisma(context);
    const due = await prisma.storeOrder.findMany({
      where: {
        status: STORE_ORDER_STATUS.OPEN,
        paymentStatus: { in: [STORE_PAYMENT_STATUS.PENDING, STORE_PAYMENT_STATUS.FAILED] },
        expiresAt: { lt: new Date() },
      },
      orderBy: [{ expiresAt: "asc" }],
      take: STORE_EXPIRE_MAX_PER_RUN,
      select: { id: true, paymentMethod: true, stripePaymentIntentId: true },
    });
    if (due instanceof Error) return { success: false, message: "No se pudieron leer los pedidos.", ...empty };

    let cancelled = 0;
    let paid = 0;
    for (const order of due as Array<{ id: string; paymentMethod: string; stripePaymentIntentId: string | null }>) {
      try {
        if (order.paymentMethod === STORE_PAYMENT_METHOD.CARD && order.stripePaymentIntentId) {
          const intent = await Stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
          if (intent.status === "succeeded") {
            await markStoreOrderPaid(context, order.id, {
              provider: STORE_PAYMENT_METHOD.CARD,
              stripePaymentIntentId: intent.id,
              stripeChargeId: typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null,
            });
            paid += 1;
            continue;
          }
          // The bank is still deciding: leave it for the next run.
          if (intent.status === "processing") continue;
        }
        const done = await cancelUnpaidStoreOrder(context, order.id, {
          reason: "No recibimos el pago a tiempo.",
          eventType: STORE_ORDER_EVENT.EXPIRED,
          notifyBuyer: true,
        });
        if (done) cancelled += 1;
      } catch (error) {
        console.error("[expireStoreOrders]", order.id, error);
      }
    }
    return {
      success: true,
      message: `Revisados ${due.length}: ${cancelled} cancelados, ${paid} pagados.`,
      checked: due.length,
      cancelled,
      paid,
    };
  },
};

export default { typeDefs, definition, resolver };
