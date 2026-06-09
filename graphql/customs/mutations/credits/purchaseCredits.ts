import { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../../../../utils/intregrations/stripe";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { SAAS_SUBSCRIPTION_LOG_STEP } from "../../../../models/Saas/SaasSubscriptionLog/constants";
import { writeSaasSubscriptionLog } from "../../../../utils/saas/saasSubscriptionLogWrite";
import { getFreePlanTrialInfo } from "../../../../utils/saas/freePlanTrial";
import { getRemainingCredits } from "../../../../utils/helpers/tech/remaining_credits";

const typeDefs = `
  input PurchaseCreditsInput {
    creditPackageId: ID!
    notes: String
    nameCard: String!
    email: String!
    paymentMethodId: String!
    total: String!
    paymentType: String!
  }

  type PurchaseCreditsResult {
    success: Boolean!
    message: String!
    paymentId: String
    creditsAdded: Int
    newCreditsTotal: Int
    subscriptionId: String
  }

  type Mutation {
    purchaseCredits(input: PurchaseCreditsInput!): PurchaseCreditsResult!
  }
`;

const definition = `
  purchaseCredits(input: PurchaseCreditsInput!): PurchaseCreditsResult!
`;

type CreditPackageRecord = {
  id: string;
  name?: string | null;
  cost?: number | null;
  currency?: string | null;
  creditsToAdd?: number | null;
  active?: boolean | null;
  stripePriceId?: string | null;
};

async function createStripeOneTimePayment(params: {
  customerId: string;
  paymentMethodId: string;
  priceId: string;
  metadata: Record<string, string>;
}) {
  const price = await Stripe.prices.retrieve(params.priceId);
  if (price.unit_amount == null) {
    throw new Error("El Stripe Price no tiene unit_amount configurado");
  }

  const paymentIntent = await Stripe.paymentIntents.create({
    amount: price.unit_amount,
    currency: price.currency,
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    confirm: true,
    off_session: true,
    metadata: params.metadata,
  });
  return paymentIntent;
}

const resolver = {
  purchaseCredits: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        creditPackageId: string;
        notes?: string | null;
        nameCard: string;
        email: string;
        paymentMethodId: string;
        total: string;
        paymentType: string;
      };
    },
    context: KeystoneContext,
  ) => {
    let stripePaymentIntentId: string | undefined;

    const startedAt = Date.now();
    const logInput = {
      planId: input.creditPackageId,
      email: input.email,
      total: input.total,
      paymentMethodId: input.paymentMethodId,
      paymentType: input.paymentType,
      notes: input.notes ?? null,
    };
    let logUserId: string | undefined;
    let logCompanyId: string | undefined;
    let logSubscriptionId: string | undefined;

    const finish = async (
      step: string,
      result: {
        success: boolean;
        message: string;
        paymentId: string | null;
        creditsAdded?: number | null;
        newCreditsTotal?: number | null;
        subscriptionId?: string | null;
      },
      opts?: {
        stripeCustomerId?: string | null;
        stripePaymentIntentId?: string | null;
        extra?: Record<string, unknown>;
      },
    ) => {
      const response = {
        creditsAdded: result.creditsAdded ?? null,
        newCreditsTotal: result.newCreditsTotal ?? null,
        subscriptionId: result.subscriptionId ?? null,
        success: result.success,
        message: result.message,
        paymentId: result.paymentId,
      };
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step,
        success: response.success,
        message: response.message,
        subscriptionId: response.subscriptionId,
        paymentId: response.paymentId,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: input.creditPackageId,
        createdSubscriptionId: response.subscriptionId,
        stripeCustomerId: opts?.stripeCustomerId ?? null,
        stripeSubscriptionId: opts?.stripePaymentIntentId ?? null,
        extra: opts?.extra,
      });
      return response;
    };

    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_KEY_MISSING, {
          success: false,
          message: "STRIPE_SECRET_KEY no configurada",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
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
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.USER_NOT_FOUND, {
          success: false,
          message: "Usuario no encontrado con ese email",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      logUserId = user.id;

      if (!user.stripeCustomerId) {
        const stripeCustomer = await Stripe.customers.create({
          email: user.email ?? input.email,
          name: user.name ?? input.nameCard,
          metadata: { userId: user.id },
        });
        await context.sudo().query.User.updateOne({
          where: { id: user.id },
          data: { stripeCustomerId: stripeCustomer.id },
        });
        user.stripeCustomerId = stripeCustomer.id;
      }

      const company = user.company;
      if (!company?.id) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_COMPANY, {
          success: false,
          message: "Tu usuario no tiene una empresa asignada",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      logCompanyId = company.id;

      const creditPackage = (await context.sudo().query.SaasCredit.findOne({
        where: { id: input.creditPackageId },
        query: "id name cost currency creditsToAdd active stripePriceId",
      })) as CreditPackageRecord | null;

      if (!creditPackage?.id) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_CREDIT_PACKAGE, {
          success: false,
          message: "Paquete de créditos no encontrado",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      if (!creditPackage.active) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.CREDIT_PACKAGE_INACTIVE, {
          success: false,
          message: "Este paquete de créditos no está disponible para compra",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      const stripePriceId = creditPackage.stripePriceId ?? null;
      if (!stripePriceId || typeof stripePriceId !== "string") {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_STRIPE_PRICE_ID, {
          success: false,
          message:
            "El paquete no tiene un Stripe Price ID configurado. Configura stripePriceId en el paquete de créditos.",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      const packageCost = creditPackage.cost ?? 0;
      const roundedTotalBack = parseFloat(Number(packageCost).toFixed(2));
      const roundedTotalFront = parseFloat(Number(input.total).toFixed(2));
      const difference = Math.abs(roundedTotalFront - roundedTotalBack);
      if (difference > 0.01) {
        return await finish(
          SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH,
          {
            success: false,
            message: `El total no coincide con el paquete. Esperado: ${roundedTotalBack}, recibido: ${roundedTotalFront}. Recarga la página e intenta de nuevo.`,
            paymentId: null,
            creditsAdded: null,
            newCreditsTotal: null,
            subscriptionId: null,
          },
          {
            extra: {
              expectedTotal: roundedTotalBack,
              receivedTotal: roundedTotalFront,
              creditPackageId: creditPackage.id,
            },
          },
        );
      }

      const creditsToAdd = creditPackage.creditsToAdd ?? 0;
      if (creditsToAdd < 1) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_CREDIT_PACKAGE, {
          success: false,
          message: "El paquete de créditos no tiene créditos configurados",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      const [activeSubscription] = await context
        .sudo()
        .query.SaasCompanySubscription.findMany({
          where: {
            company: { id: { equals: company.id } },
            status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
          },
          orderBy: [{ activatedAt: "desc" }],
          take: 1,
          query: "id planCost activatedAt newCreditsAdded",
        });

      if (!activeSubscription) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_ACTIVE_SUBSCRIPTION, {
          success: false,
          message:
            "No tienes una suscripción activa. Contrata un plan antes de comprar créditos extra.",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: null,
        });
      }

      const sub = activeSubscription as {
        id: string;
        planCost?: number | null;
        activatedAt?: string | null;
        newCreditsAdded?: number | null;
      };

      logSubscriptionId = sub.id;

      const isFreePlan = sub.planCost != null && sub.planCost <= 0;
      if (isFreePlan && sub.activatedAt) {
        const { isExpired } = getFreePlanTrialInfo(sub.activatedAt);
        if (isExpired) {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_ACTIVE_SUBSCRIPTION, {
            success: false,
            message:
              "Tu plan gratuito ha terminado. Contrata o activa una suscripción antes de comprar créditos extra.",
            paymentId: null,
            creditsAdded: null,
            newCreditsTotal: null,
            subscriptionId: sub.id,
          });
        }
      }

      const paymentMethod = (await context.sudo().query.SaasPaymentMethod.findOne({
        where: { id: input.paymentMethodId },
        query: "id stripePaymentMethodId",
      })) as { id: string; stripePaymentMethodId: string | null } | null;

      if (!paymentMethod?.stripePaymentMethodId) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND, {
          success: false,
          message: "Método de pago no encontrado",
          paymentId: null,
          creditsAdded: null,
          newCreditsTotal: null,
          subscriptionId: sub.id,
        });
      }

      try {
        await Stripe.paymentMethods.attach(paymentMethod.stripePaymentMethodId, {
          customer: user.stripeCustomerId!,
        });
      } catch (attachErr: unknown) {
        const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
        if (!msg.toLowerCase().includes("already been attached")) throw attachErr;
      }
      await Stripe.customers.update(user.stripeCustomerId!, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripePaymentMethodId,
        },
      });

      const paymentIntent = await createStripeOneTimePayment({
        customerId: user.stripeCustomerId!,
        paymentMethodId: paymentMethod.stripePaymentMethodId,
        priceId: stripePriceId,
        metadata: {
          companyId: company.id,
          subscriptionId: sub.id,
          creditPackageId: creditPackage.id,
          creditsToAdd: String(creditsToAdd),
          stripePriceId,
        },
      });

      stripePaymentIntentId = paymentIntent.id;

      if (paymentIntent.status !== "succeeded") {
        const failedPayment = await context.sudo().query.SaasPayment.createOne({
          data: {
            user: { connect: { id: user.id } },
            paymentMethod: { connect: { id: paymentMethod.id } },
            amount: String(packageCost),
            status: "failed",
            processorStripeChargeId: paymentIntent.id,
            stripeErrorMessage: `PaymentIntent status: ${paymentIntent.status}`,
            subscription: { connect: { id: sub.id } },
            notes:
              input.notes ??
              `Compra de créditos fallida: ${creditPackage.name ?? creditPackage.id}`,
          },
          query: "id",
        });

        return await finish(
          SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
          {
            success: false,
            message: "El pago no se completó. Verifica tu método de pago e intenta de nuevo.",
            paymentId: (failedPayment as { id: string }).id,
            creditsAdded: null,
            newCreditsTotal: null,
            subscriptionId: sub.id,
          },
          {
            stripeCustomerId: user.stripeCustomerId ?? null,
            stripePaymentIntentId: paymentIntent.id,
            extra: { paymentIntentStatus: paymentIntent.status },
          },
        );
      }

      const currentExtraCredits = sub.newCreditsAdded ?? 0;
      const extraCreditsStored = currentExtraCredits + creditsToAdd;

      await context.sudo().query.SaasCompanySubscription.updateOne({
        where: { id: sub.id },
        data: { newCreditsAdded: extraCreditsStored },
      });

      const credits = await getRemainingCredits(context, company.id);
      const newCreditsTotal = credits.remainingQuota;

      const payment = await context.sudo().query.SaasPayment.createOne({
        data: {
          user: { connect: { id: user.id } },
          paymentMethod: { connect: { id: paymentMethod.id } },
          amount: String(packageCost),
          status: "succeeded",
          processorStripeChargeId: paymentIntent.id,
          subscription: { connect: { id: sub.id } },
          notes:
            input.notes ??
            `Compra de créditos: ${creditPackage.name ?? creditPackage.id} (+${creditsToAdd})`,
        },
        query: "id",
      });

      const paymentId = (payment as { id: string }).id;

      return await finish(
        SAAS_SUBSCRIPTION_LOG_STEP.CREDIT_SUCCESS,
        {
          success: true,
          message: `Se añadieron ${creditsToAdd} créditos a tu suscripción activa.`,
          paymentId,
          creditsAdded: creditsToAdd,
          newCreditsTotal,
          subscriptionId: sub.id,
        },
        {
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripePaymentIntentId: paymentIntent.id,
          extra: {
            creditPackageId: creditPackage.id,
            creditsAdded: creditsToAdd,
            extraCreditsStored,
            remainingQuota: newCreditsTotal,
            syncedCount: credits.syncedCount,
            leadLimit: credits.leadLimit,
          },
        },
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error de comunicación con el servidor. Intenta de nuevo.";
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step: SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
        success: false,
        message,
        subscriptionId: logSubscriptionId ?? null,
        paymentId: null,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: input.creditPackageId,
        createdSubscriptionId: logSubscriptionId ?? null,
        stripeSubscriptionId: stripePaymentIntentId ?? null,
        extra: {
          errorName: e instanceof Error ? e.name : "unknown",
          creditPackageId: input.creditPackageId,
        },
      });
      return {
        success: false,
        message,
        paymentId: null,
        creditsAdded: null,
        newCreditsTotal: null,
        subscriptionId: logSubscriptionId ?? null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
