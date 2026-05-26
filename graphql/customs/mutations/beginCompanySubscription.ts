import { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../../../utils/intregrations/stripe";
import { SAAS_SUBSCRIPTION_LOG_STEP } from "../../../models/Saas/SaasSubscriptionLog/constants";
import { writeSaasSubscriptionLog } from "../../../utils/saas/saasSubscriptionLogWrite";

const typeDefs = `
  input BeginCompanySubscriptionInput {
    planId: ID!
    email: String!
    total: String!
  }

  type BeginCompanySubscriptionResult {
    success: Boolean!
    message: String!
    clientSecret: String
    stripeSubscriptionId: String
    stripePaymentIntentId: String
  }

  type Mutation {
    beginCompanySubscription(input: BeginCompanySubscriptionInput!): BeginCompanySubscriptionResult!
  }
`;

const definition = `
  beginCompanySubscription(input: BeginCompanySubscriptionInput!): BeginCompanySubscriptionResult!
`;

type PlanRecord = {
  id: string;
  cost?: number | null;
  stripePriceId?: string | null;
  currency?: string | null;
};

function isMxnCurrency(currency: string | null | undefined): boolean {
  return (currency ?? "").trim().toLowerCase() === "mxn";
}

type InvoiceLike = {
  confirmation_secret?: { client_secret?: string | null } | null;
  payment_intent?: { id?: string; client_secret?: string | null } | string | null;
};

async function resolveInvoice(
  subscription: { latest_invoice?: unknown },
): Promise<InvoiceLike | null> {
  const latest = subscription.latest_invoice;
  if (latest && typeof latest === "object") {
    return latest as InvoiceLike;
  }
  if (typeof latest === "string") {
    return (await Stripe.invoices.retrieve(latest, {
      expand: ["confirmation_secret", "payment_intent"],
    })) as InvoiceLike;
  }
  return null;
}

function resolvePaymentIntentId(invoice: InvoiceLike): string | null {
  const paymentIntent = invoice.payment_intent;
  if (typeof paymentIntent === "string") return paymentIntent;
  if (paymentIntent && typeof paymentIntent === "object" && paymentIntent.id) {
    return paymentIntent.id;
  }
  return null;
}

async function resolveSubscriptionInvoiceClientSecret(
  subscription: { latest_invoice?: unknown },
): Promise<string | null> {
  const invoice = await resolveInvoice(subscription);
  if (!invoice) return null;

  const paymentIntentId = resolvePaymentIntentId(invoice);
  if (paymentIntentId) {
    const pi = await Stripe.paymentIntents.retrieve(paymentIntentId);
    return pi.client_secret ?? null;
  }

  const confirmationSecret = invoice.confirmation_secret;
  if (
    confirmationSecret &&
    typeof confirmationSecret === "object" &&
    confirmationSecret.client_secret
  ) {
    return confirmationSecret.client_secret;
  }

  return null;
}

/** MSI: standalone PaymentIntent (Stripe no soporta MSI en facturas de suscripción). */
async function beginMsiCheckout(params: {
  customerId: string;
  plan: PlanRecord;
  companyId: string;
  userId: string;
  amountCents: number;
}) {
  const paymentIntent = await Stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: "mxn",
    customer: params.customerId,
    setup_future_usage: "off_session",
    payment_method_types: ["card"],
    payment_method_options: {
      card: {
        installments: {
          enabled: true,
        },
      },
    },
    metadata: {
      companyId: params.companyId,
      planId: params.plan.id,
      userId: params.userId,
      checkoutType: "saas_subscription_msi",
    },
  });

  return {
    clientSecret: paymentIntent.client_secret ?? null,
    stripePaymentIntentId: paymentIntent.id,
    stripeSubscriptionId: null as string | null,
  };
}

const resolver = {
  beginCompanySubscription: async (
    _root: unknown,
    {
      input,
    }: {
      input: { planId: string; email: string; total: string };
    },
    context: KeystoneContext,
  ) => {
    const startedAt = Date.now();
    const logInput = {
      planId: input.planId,
      email: input.email,
      total: input.total,
      paymentMethodId: null,
      paymentType: "subscription_checkout",
      notes: null,
    };

    const fail = async (step: string, message: string) => {
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step,
        success: false,
        message,
        subscriptionId: null,
        paymentId: null,
      });
      return {
        success: false,
        message,
        clientSecret: null,
        stripeSubscriptionId: null,
        stripePaymentIntentId: null,
      };
    };

    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_KEY_MISSING,
          "STRIPE_SECRET_KEY no configurada",
        );
      }

      const user = (await context.sudo().query.User.findOne({
        where: { email: input.email.trim() },
        query: "id name email stripeCustomerId company { id }",
      })) as {
        id: string;
        name?: string | null;
        email?: string | null;
        stripeCustomerId?: string | null;
        company?: { id: string } | null;
      } | null;

      if (!user) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.USER_NOT_FOUND,
          "Usuario no encontrado con ese email",
        );
      }

      if (!user.company?.id) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.NO_COMPANY,
          "Tu usuario no tiene una empresa asignada",
        );
      }

      const plan = (await context.sudo().query.SaasPlan.findOne({
        where: { id: input.planId },
        query: "id cost stripePriceId currency",
      })) as PlanRecord | null;

      if (!plan?.id) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.NO_PLAN_RESOLVED,
          "Plan no encontrado",
        );
      }

      const stripePriceId = plan.stripePriceId ?? null;
      if (!stripePriceId) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.NO_STRIPE_PRICE_ID,
          "El plan no tiene un Stripe Price ID configurado.",
        );
      }

      const planCost = plan.cost ?? 0;
      const roundedTotalBack = parseFloat(Number(planCost).toFixed(2));
      const roundedTotalFront = parseFloat(Number(input.total).toFixed(2));
      if (Math.abs(roundedTotalFront - roundedTotalBack) > 0.01) {
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH,
          `El total no coincide con el plan. Esperado: ${roundedTotalBack}, recibido: ${roundedTotalFront}.`,
        );
      }

      if (!user.stripeCustomerId) {
        const stripeCustomer = await Stripe.customers.create({
          email: user.email ?? input.email,
          name: user.name ?? undefined,
          metadata: { userId: user.id },
        });
        await context.sudo().query.User.updateOne({
          where: { id: user.id },
          data: { stripeCustomerId: stripeCustomer.id },
        });
        user.stripeCustomerId = stripeCustomer.id;
      }

      const customerId = user.stripeCustomerId!;
      const stripePrice = await Stripe.prices.retrieve(stripePriceId);
      const enableInstallments =
        isMxnCurrency(plan.currency) ||
        (stripePrice.currency ?? "").toLowerCase() === "mxn";

      if (enableInstallments) {
        if ((stripePrice.currency ?? "").toLowerCase() !== "mxn") {
          return fail(
            SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
            "El precio en Stripe debe estar en MXN para aceptar meses sin intereses.",
          );
        }

        const amountCents = Math.round(roundedTotalBack * 100);
        const checkout = await beginMsiCheckout({
          customerId,
          plan,
          companyId: user.company.id,
          userId: user.id,
          amountCents,
        });

        if (!checkout.clientSecret || !checkout.stripePaymentIntentId) {
          return fail(
            SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
            "No se pudo iniciar el pago con meses sin intereses.",
          );
        }

        await writeSaasSubscriptionLog(context, {
          startedAt,
          input: logInput,
          step: "BEGIN_SUBSCRIPTION_MSI_CHECKOUT",
          success: true,
          message: "Checkout MSI iniciado (PaymentIntent)",
          subscriptionId: null,
          paymentId: null,
          userId: user.id,
          companyId: user.company.id,
          planId: plan.id,
          stripeCustomerId: customerId,
          extra: { stripePaymentIntentId: checkout.stripePaymentIntentId },
        });

        return {
          success: true,
          message: "Checkout iniciado",
          clientSecret: checkout.clientSecret,
          stripeSubscriptionId: null,
          stripePaymentIntentId: checkout.stripePaymentIntentId,
        };
      }

      const incompleteSubs = await Stripe.subscriptions.list({
        customer: customerId,
        status: "incomplete",
        limit: 20,
      });
      for (const sub of incompleteSubs.data) {
        try {
          await Stripe.subscriptions.cancel(sub.id);
        } catch {
          /* ignore */
        }
      }

      const subscription = await Stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        metadata: {
          companyId: user.company.id,
          planId: plan.id,
          userId: user.id,
        },
        expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
      });

      const clientSecret = await resolveSubscriptionInvoiceClientSecret(subscription);

      if (!clientSecret) {
        try {
          await Stripe.subscriptions.cancel(subscription.id);
        } catch {
          /* ignore */
        }
        return fail(
          SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
          "No se pudo obtener la sesión de pago de Stripe. Verifica el Price del plan e intenta de nuevo.",
        );
      }

      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step: "BEGIN_SUBSCRIPTION_CHECKOUT",
        success: true,
        message: "Checkout de suscripción iniciado",
        subscriptionId: null,
        paymentId: null,
        userId: user.id,
        companyId: user.company.id,
        planId: plan.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
      });

      return {
        success: true,
        message: "Checkout iniciado",
        clientSecret,
        stripeSubscriptionId: subscription.id,
        stripePaymentIntentId: null,
      };
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Error de comunicación con el servidor. Intenta de nuevo.";
      return fail(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR, message);
    }
  },
};

export default { typeDefs, definition, resolver };
