import type { Express, Request, Response } from "express";
import express from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../utils/intregrations/stripe";
import { SUBSCRIPTION_STATUS } from "../models/Saas/SaasCompanySubscription/constants";
import { ACTIVITY_EVENT, ACTIVITY_SOURCE } from "../models/ActivityEvent/constants";
import { logActivity } from "../utils/activity/logActivity";
import { stripePeriodEnd } from "../utils/saas/stripeSubscription";
import {
  applySubscriptionState,
  stripeStatusToLocal,
  unixToDay,
  type LocalSubscription,
} from "../utils/saas/stripeSubscriptionSync";

/**
 * Webhook de Stripe: lo que pasa con el cobro después del checkout.
 * - `invoice.paid` (renovación) → `SaasPayment` + fin de periodo + `billing.renewed`.
 * - `invoice.payment_failed` → `SaasPayment` fallido + `billing.payment_failed`.
 * - `customer.subscription.updated` / `.deleted` → estado local (+ `billing.status_changed` / `billing.cancelled`).
 * - `charge.refunded` → el `SaasPayment` queda `refunded` + `billing.refunded`.
 *
 * Firma obligatoria con `STRIPE_WEBHOOK_SECRET`; sin esa variable no procesa nada.
 * Idempotente por estado: Stripe reintenta y a veces repite eventos, así que cada handler revisa
 * si el cobro ya existe o si el estado ya es el mismo antes de escribir.
 * Lee los dos formatos de la API (antes y después de 2025-03 "basil", donde se movieron
 * `invoice.subscription`, `invoice.charge` y `current_period_end`, y el cargo dejó de traer `invoice`).
 * El endpoint de producción usa 2025-05-28.basil.
 */

const WEBHOOK_PATH = "/webhooks/stripe";

type AnyObject = Record<string, any>;

function str(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof (value as AnyObject).id === "string") {
    return (value as AnyObject).id;
  }
  return null;
}

function subscriptionIdFromInvoice(invoice: AnyObject): string | null {
  return (
    str(invoice.subscription) ??
    str(invoice.parent?.subscription_details?.subscription) ??
    str(invoice.lines?.data?.find((line: AnyObject) => line?.subscription)?.subscription) ??
    str(invoice.lines?.data?.find((line: AnyObject) => line?.parent?.subscription_item_details)
      ?.parent?.subscription_item_details?.subscription)
  );
}

function invoicePeriodEnd(invoice: AnyObject): number | null {
  const ends = (invoice.lines?.data ?? [])
    .map((line: AnyObject) => line?.period?.end)
    .filter((end: unknown): end is number => typeof end === "number");
  return ends.length ? Math.max(...ends) : null;
}

/** Referencia del cobro para no duplicarlo: cargo, PaymentIntent o, si no hay, la factura. */
function invoicePaymentRef(invoice: AnyObject): string {
  return (
    str(invoice.charge) ??
    str(invoice.payment_intent) ??
    str(invoice.payments?.data?.[0]?.payment?.payment_intent) ??
    str(invoice.payments?.data?.[0]?.payment?.charge) ??
    invoice.id
  );
}

function toAmount(cents: unknown): number {
  return typeof cents === "number" ? cents / 100 : 0;
}

function eventDate(event: AnyObject): Date {
  return typeof event.created === "number" ? new Date(event.created * 1000) : new Date();
}

type LocalSubscriptionRow = LocalSubscription & { planId: string | null };

async function findLocalSubscription(
  context: KeystoneContext,
  stripeSubscriptionId: string | null,
): Promise<LocalSubscriptionRow | null> {
  if (!stripeSubscriptionId) return null;
  const prisma = context.sudo().prisma as any;
  const row = await prisma.saasCompanySubscription.findFirst({
    where: { stripeSubscriptionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      companyId: true,
      planName: true,
      planId: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    status: row.status ?? null,
    currentPeriodEnd: row.currentPeriodEnd
      ? new Date(row.currentPeriodEnd).toISOString().slice(0, 10)
      : null,
    companyId: row.companyId ?? null,
    planName: row.planName ?? null,
    planId: row.planId ?? null,
  };
}

async function findPayer(context: KeystoneContext, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const prisma = context.sudo().prisma as any;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function paymentExists(context: KeystoneContext, ref: string): Promise<boolean> {
  const prisma = context.sudo().prisma as any;
  const found = await prisma.saasPayment.findFirst({
    where: { processorStripeChargeId: ref },
    select: { id: true },
  });
  return Boolean(found);
}

async function handleInvoicePaid(context: KeystoneContext, event: AnyObject) {
  const invoice = event.data?.object as AnyObject;
  // El primer cobro ya lo registra createCompanySubscription.
  if (!invoice || invoice.billing_reason === "subscription_create") return;
  const sub = await findLocalSubscription(context, subscriptionIdFromInvoice(invoice));
  if (!sub) return;

  const ref = invoicePaymentRef(invoice);
  const amount = toAmount(invoice.amount_paid);
  const periodEnd = unixToDay(invoicePeriodEnd(invoice));
  const renewal = invoice.billing_reason === "subscription_cycle";
  const plan = sub.planName ? ` ${sub.planName}` : "";

  if (!(await paymentExists(context, ref))) {
    const payerId = await findPayer(context, str(invoice.customer));
    await context.sudo().query.SaasPayment.createOne({
      data: {
        ...(payerId ? { user: { connect: { id: payerId } } } : {}),
        paymentMethodType: "card",
        amount: String(amount),
        status: "succeeded",
        processorStripeChargeId: ref,
        ...(sub.planId ? { plan: { connect: { id: sub.planId } } } : {}),
        subscription: { connect: { id: sub.id } },
        notes: `${renewal ? "Renovación" : "Cobro"}${plan} (Stripe ${invoice.id})`,
      },
      query: "id",
    });

    void logActivity(context, {
      type: ACTIVITY_EVENT.BILLING_RENEWED,
      actorId: payerId,
      companyId: sub.companyId ?? null,
      entityType: "SaasCompanySubscription",
      entityId: sub.id,
      summary: renewal ? `Se renovó el plan${plan}` : `Cobro del plan${plan}`,
      metadata: {
        amount,
        currency: invoice.currency ?? null,
        billingReason: invoice.billing_reason ?? null,
        periodEnd,
        stripeInvoiceId: invoice.id,
      },
      source: ACTIVITY_SOURCE.WEBHOOK,
      occurredAt: eventDate(event),
    });
  }

  // Pagó: si estaba con pago vencido, vuelve a activa; el periodo avanza.
  const recovered =
    sub.status === SUBSCRIPTION_STATUS.PAST_DUE || sub.status === SUBSCRIPTION_STATUS.UNPAID;
  await applySubscriptionState(
    context,
    sub,
    { status: recovered ? SUBSCRIPTION_STATUS.ACTIVE : sub.status ?? SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: periodEnd },
    { source: ACTIVITY_SOURCE.WEBHOOK, occurredAt: eventDate(event), reason: "invoice_paid" },
  );
}

async function handleInvoicePaymentFailed(context: KeystoneContext, event: AnyObject) {
  const invoice = event.data?.object as AnyObject;
  if (!invoice) return;
  const sub = await findLocalSubscription(context, subscriptionIdFromInvoice(invoice));
  if (!sub) return;

  const attempt = typeof invoice.attempt_count === "number" ? invoice.attempt_count : 1;
  // Cada reintento es un cargo distinto; sin id de cargo, la factura + número de intento.
  const ref = str(invoice.charge) ?? `${invoice.id}#${attempt}`;
  if (await paymentExists(context, ref)) return;

  const amount = toAmount(invoice.amount_due);
  const payerId = await findPayer(context, str(invoice.customer));
  const nextAttempt =
    typeof invoice.next_payment_attempt === "number"
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null;

  await context.sudo().query.SaasPayment.createOne({
    data: {
      ...(payerId ? { user: { connect: { id: payerId } } } : {}),
      paymentMethodType: "card",
      amount: String(amount),
      status: "failed",
      processorStripeChargeId: ref,
      stripeErrorMessage: `Stripe no pudo cobrar la renovación (intento ${attempt})`,
      ...(sub.planId ? { plan: { connect: { id: sub.planId } } } : {}),
      subscription: { connect: { id: sub.id } },
      notes: `Renovación fallida${sub.planName ? ` ${sub.planName}` : ""} (Stripe ${invoice.id})`,
    },
    query: "id",
  });

  void logActivity(context, {
    type: ACTIVITY_EVENT.BILLING_PAYMENT_FAILED,
    actorId: payerId,
    companyId: sub.companyId ?? null,
    entityType: "SaasCompanySubscription",
    entityId: sub.id,
    summary: `Falló el cobro de la renovación (intento ${attempt})`,
    success: false,
    errorMessage: "Stripe no pudo cobrar la renovación",
    metadata: { amount, currency: invoice.currency ?? null, attempt, nextAttempt, stripeInvoiceId: invoice.id },
    source: ACTIVITY_SOURCE.WEBHOOK,
    occurredAt: eventDate(event),
  });
}

async function handleSubscriptionChange(context: KeystoneContext, event: AnyObject) {
  const subscription = event.data?.object as AnyObject;
  if (!subscription?.id) return;
  const sub = await findLocalSubscription(context, subscription.id);
  if (!sub) return;

  const deleted = event.type === "customer.subscription.deleted";
  const status = deleted
    ? SUBSCRIPTION_STATUS.CANCELLED
    : stripeStatusToLocal(typeof subscription.status === "string" ? subscription.status : null);

  await applySubscriptionState(
    context,
    sub,
    { status, currentPeriodEnd: unixToDay(stripePeriodEnd(subscription)) },
    { source: ACTIVITY_SOURCE.WEBHOOK, occurredAt: eventDate(event), reason: event.type },
  );
}

/**
 * Factura de un PaymentIntent. Desde la API 2025-03 ("basil") el cargo ya no trae `invoice` y los
 * cobros de suscripción quedan guardados con el id de la factura, así que hay que preguntarle a Stripe.
 */
async function invoiceIdForPaymentIntent(paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const list = await Stripe.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: paymentIntentId },
      limit: 1,
    });
    return str(list?.data?.[0]?.invoice);
  } catch {
    return null;
  }
}

async function findPaymentByRefs(context: KeystoneContext, refs: string[]) {
  if (!refs.length) return null;
  const prisma = context.sudo().prisma as any;
  return prisma.saasPayment.findFirst({
    where: { processorStripeChargeId: { in: refs } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      userId: true,
      subscriptionId: true,
      subscription: { select: { companyId: true } },
      user: { select: { companyId: true } },
    },
  });
}

async function handleChargeRefunded(context: KeystoneContext, event: AnyObject) {
  const charge = event.data?.object as AnyObject;
  if (!charge?.id) return;
  const refs = [charge.id, str(charge.payment_intent), str(charge.invoice)].filter(
    (ref): ref is string => Boolean(ref),
  );
  let payment = await findPaymentByRefs(context, refs);
  if (!payment) {
    const invoiceId = await invoiceIdForPaymentIntent(str(charge.payment_intent));
    if (invoiceId) payment = await findPaymentByRefs(context, [invoiceId]);
  }
  if (!payment || payment.status === "refunded") return;

  await context.sudo().query.SaasPayment.updateOne({
    where: { id: payment.id },
    data: { status: "refunded" },
    query: "id",
  });

  const amount = toAmount(charge.amount_refunded);
  void logActivity(context, {
    type: ACTIVITY_EVENT.BILLING_REFUNDED,
    actorId: payment.userId ?? null,
    companyId: payment.subscription?.companyId ?? payment.user?.companyId ?? null,
    entityType: "SaasPayment",
    entityId: payment.id,
    summary: `Se reembolsó un cobro`,
    metadata: { amount, currency: charge.currency ?? null, stripeChargeId: charge.id },
    source: ACTIVITY_SOURCE.WEBHOOK,
    occurredAt: eventDate(event),
  });
}

const HANDLERS: Record<string, (context: KeystoneContext, event: AnyObject) => Promise<void>> = {
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "customer.subscription.updated": handleSubscriptionChange,
  "customer.subscription.deleted": handleSubscriptionChange,
  "charge.refunded": handleChargeRefunded,
};

/** Aplica un evento ya verificado. Exportado para pruebas y para reprocesar eventos a mano. */
export async function processStripeEvent(context: KeystoneContext, event: AnyObject): Promise<boolean> {
  const handler = HANDLERS[event?.type];
  if (!handler) return false;
  await handler(context, event);
  return true;
}

async function handleStripeWebhook(req: Request, res: Response, context: KeystoneContext) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[stripe webhook] falta STRIPE_WEBHOOK_SECRET: evento ignorado");
    res.status(503).send("Webhook de Stripe sin configurar");
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event: AnyObject;
  try {
    event = Stripe.webhooks.constructEvent(req.body as Buffer, signature as string, secret);
  } catch (err) {
    console.warn(
      "[stripe webhook] firma inválida:",
      err instanceof Error ? err.message : err,
    );
    res.status(400).send("Firma inválida");
    return;
  }

  if (!HANDLERS[event.type]) {
    res.json({ received: true, ignored: event.type });
    return;
  }

  try {
    await processStripeEvent(context, event);
    res.json({ received: true });
  } catch (err) {
    // 500 para que Stripe reintente; los handlers son idempotentes.
    console.error(`[stripe webhook] error procesando ${event.type} (${event.id}):`, err);
    res.status(500).send("Error procesando el evento");
  }
}

export default function registerStripeWebhook(app: Express, context: KeystoneContext) {
  app.post(
    WEBHOOK_PATH,
    express.raw({ type: "application/json" }),
    (req: Request, res: Response) => handleStripeWebhook(req, res, context),
  );
}
