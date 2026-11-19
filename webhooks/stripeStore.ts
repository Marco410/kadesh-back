import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_ORDER_EVENT,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
} from "../models/Pet/Store/constants";
import { storePrisma } from "../utils/store/catalog";
import { addStoreOrderEvent, markStoreOrderPaid, refundStoreOrder } from "../utils/store/orders";

/**
 * Stripe events of the Kadesh Pet store (the rest of `webhooks/stripe.ts` is SaaS billing).
 * A store PaymentIntent carries `metadata.kind = "store_order"` and the order id.
 *
 * Like the other handlers, these are idempotent by state: Stripe retries and repeats events.
 */

type AnyObject = Record<string, any>;

export const STORE_ORDER_KIND = "store_order";

function chargeIdOf(intent: AnyObject): string | null {
  const charge = intent.latest_charge;
  if (typeof charge === "string" && charge) return charge;
  return typeof charge?.id === "string" ? charge.id : null;
}

/** `payment_intent.succeeded`: the card was charged. */
export async function handleStorePaymentIntentSucceeded(context: KeystoneContext, event: AnyObject): Promise<void> {
  const intent = event.data?.object as AnyObject;
  if (intent?.metadata?.kind !== STORE_ORDER_KIND) return;
  const orderId = String(intent.metadata.orderId ?? "");
  if (!orderId) return;
  await markStoreOrderPaid(context, orderId, {
    provider: STORE_PAYMENT_METHOD.CARD,
    stripePaymentIntentId: intent.id,
    stripeChargeId: chargeIdOf(intent),
  });
}

/**
 * `payment_intent.payment_failed`: the card was declined. The order stays open and unpaid, so the
 * person can try another card until it expires.
 */
export async function handleStorePaymentIntentFailed(context: KeystoneContext, event: AnyObject): Promise<void> {
  const intent = event.data?.object as AnyObject;
  if (intent?.metadata?.kind !== STORE_ORDER_KIND) return;
  const orderId = String(intent.metadata.orderId ?? "");
  if (!orderId) return;
  const reason = String(intent.last_payment_error?.message ?? "El banco rechazó el cobro.").slice(0, 300);
  const updated = await storePrisma(context).storePayment.updateMany({
    where: { orderId, stripePaymentIntentId: intent.id, status: STORE_PAYMENT_ATTEMPT_STATUS.PENDING },
    data: { status: STORE_PAYMENT_ATTEMPT_STATUS.FAILED, errorMessage: reason },
  });
  if (updated instanceof Error) throw updated;
  // Only the first failure of an attempt is written to the timeline.
  if (updated.count === 1) {
    await addStoreOrderEvent(context, {
      orderId,
      type: STORE_ORDER_EVENT.PAYMENT_FAILED,
      message: "Tu tarjeta no pasó. Puedes intentar con otra.",
      isPublic: true,
      metadata: { reason },
    });
  }
}

/**
 * `charge.refunded` for a store charge (a refund made on the Stripe dashboard; the ones made from
 * Operaciones already left the order refunded). Answers whether the charge was a store one, so the
 * SaaS handler does not look for it.
 */
export async function handleStoreChargeRefunded(context: KeystoneContext, charge: AnyObject): Promise<boolean> {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  const prisma = storePrisma(context);
  const payment = await prisma.storePayment.findFirst({
    where: { OR: [{ stripeChargeId: charge.id }, ...(intentId ? [{ stripePaymentIntentId: intentId }] : [])] },
    select: { id: true, orderId: true, status: true, amountCents: true },
  });
  if (payment instanceof Error) throw payment;
  if (!payment) return charge.metadata?.kind === STORE_ORDER_KIND;
  if (!payment.orderId || payment.status === STORE_PAYMENT_ATTEMPT_STATUS.REFUNDED) return true;

  const refunded = Number(charge.amount_refunded) || 0;
  if (charge.refunded === true || refunded >= payment.amountCents) {
    await refundStoreOrder(context, payment.orderId, {
      reason: "Reembolso hecho desde Stripe.",
      restock: false,
      alreadyRefundedOnStripe: true,
    });
    return true;
  }

  // Partial refund: the order goes on. Record the amount once.
  const updated = await prisma.storePayment.updateMany({
    where: { id: payment.id, refundedCents: { not: refunded } },
    data: { refundedCents: refunded },
  });
  if (updated instanceof Error) throw updated;
  if (updated.count === 1) {
    await addStoreOrderEvent(context, {
      orderId: payment.orderId,
      type: STORE_ORDER_EVENT.NOTE,
      message: `Reembolso parcial desde Stripe: ${(refunded / 100).toFixed(2)} MXN en total.`,
      metadata: { refundedCents: refunded },
    });
  }
  return true;
}
