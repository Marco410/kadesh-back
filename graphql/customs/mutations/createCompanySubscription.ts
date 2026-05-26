import { KeystoneContext } from "@keystone-6/core/types";
import type StripeType from "stripe";
import Stripe from "../../../utils/intregrations/stripe";
import { SUBSCRIPTION_STATUS } from "../../../models/Saas/SaasCompanySubscription/constants";
import { PLAN_FREQUENCY } from "../../../models/Saas/SaasPlan/constants";
import { SAAS_SUBSCRIPTION_LOG_STEP } from "../../../models/Saas/SaasSubscriptionLog/constants";
import { writeSaasSubscriptionLog } from "../../../utils/saas/saasSubscriptionLogWrite";

const typeDefs = `
  input CreateCompanySubscriptionInput {
    planId: ID!
    notes: String
    nameCard: String!
    email: String!
    paymentMethodId: String
    total: String!
    paymentType: String!
    noDuplicatePaymentMethod: Boolean
    stripeSubscriptionId: String
    stripePaymentIntentId: String
  }

  type CreateCompanySubscriptionResult {
    success: Boolean!
    message: String!
    subscriptionId: String
    paymentId: String
  }

  type Mutation {
    createCompanySubscription(input: CreateCompanySubscriptionInput!): CreateCompanySubscriptionResult!
  }
`;

const definition = `
  createCompanySubscription(input: CreateCompanySubscriptionInput!): CreateCompanySubscriptionResult!
`;

type PlanRecord = {
  id: string;
  name?: string | null;
  cost?: number | null;
  frequency?: string | null;
  leadLimit?: number | null;
  currency?: string | null;
  planFeatures?: unknown;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
};

/** Creates a Stripe Subscription using the plan's stripePriceId (recurring). */
async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  defaultPaymentMethodId: string;
  metadata: { companyId: string; planId: string };
}) {
  const subscription = await Stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    default_payment_method: params.defaultPaymentMethodId,
    payment_behavior: "error_if_incomplete",
    metadata: params.metadata,
    expand: ["latest_invoice"],
  });
  return subscription;
}

/** Extrae campos útiles de errores Stripe para SaasSubscriptionLog.responseSnapshot. */
function serializeStripeError(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object" && "type" in err) {
    const stripeErr = err as StripeType.StripeRawError & { requestId?: string };
    return {
      type: stripeErr.type ?? null,
      code: stripeErr.code ?? null,
      param: stripeErr.param ?? null,
      message: stripeErr.message ?? null,
      statusCode: stripeErr.statusCode ?? null,
      requestId: stripeErr.requestId ?? null,
    };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { message: String(err) };
}

function resolvePaymentMethodId(
  paymentMethod: StripeType.PaymentIntent["payment_method"],
): string | null {
  if (typeof paymentMethod === "string") return paymentMethod;
  if (paymentMethod && typeof paymentMethod === "object" && "id" in paymentMethod) {
    return (paymentMethod as { id: string }).id;
  }
  return null;
}

function buildPaymentIntentSnapshot(pi: StripeType.PaymentIntent): Record<string, unknown> {
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    customer: pi.customer ?? null,
    setup_future_usage: pi.setup_future_usage ?? null,
    paymentMethodId: resolvePaymentMethodId(pi.payment_method),
    metadata: pi.metadata ?? {},
  };
}

async function buildPaymentMethodSnapshot(
  paymentMethodId: string,
): Promise<Record<string, unknown>> {
  try {
    const pm = await Stripe.paymentMethods.retrieve(paymentMethodId);
    return {
      id: pm.id,
      type: pm.type,
      customer: pm.customer ?? null,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          }
        : null,
    };
  } catch (retrieveErr: unknown) {
    return {
      id: paymentMethodId,
      retrieveError: serializeStripeError(retrieveErr),
    };
  }
}

/** Primer periodo ya cobrado con MSI vía PaymentIntent; la suscripción inicia en trial hasta el siguiente ciclo. */
function computeTrialEndUnix(frequency: string | null | undefined): number {
  const d = new Date();
  const f = (frequency ?? "").toLowerCase();
  if (f === PLAN_FREQUENCY.ANNUAL) {
    d.setFullYear(d.getFullYear() + 1);
  } else if (f === PLAN_FREQUENCY.WEEKLY) {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return Math.floor(d.getTime() / 1000);
}

const resolver = {
  createCompanySubscription: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        planId: string;
        notes?: string | null;
        nameCard: string;
        email: string;
        paymentMethodId?: string | null;
        total: string;
        paymentType: string;
        noDuplicatePaymentMethod?: boolean;
        stripeSubscriptionId?: string | null;
        stripePaymentIntentId?: string | null;
      };
    },
    context: KeystoneContext
  ) => {
    let stripeSubscriptionId: string | undefined;
    let prepaidMsiSubscription: Awaited<ReturnType<typeof createStripeSubscription>> | null =
      null;

    const startedAt = Date.now();
    const logInput = {
      planId: input.planId,
      email: input.email,
      total: input.total,
      paymentMethodId: input.paymentMethodId,
      paymentType: input.paymentType,
      notes: input.notes ?? null,
    };
    let logUserId: string | undefined;
    let logCompanyId: string | undefined;
    let logPlanId: string | undefined;

    const finish = async (
      step: string,
      result: {
        success: boolean;
        message: string;
        subscriptionId: string | null;
        paymentId: string | null;
      },
      opts?: {
        createdSubscriptionId?: string | null;
        stripeCustomerId?: string | null;
        stripeSubscriptionId?: string | null;
        extra?: Record<string, unknown>;
      },
    ) => {
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step,
        success: result.success,
        message: result.message,
        subscriptionId: result.subscriptionId,
        paymentId: result.paymentId,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: logPlanId ?? null,
        createdSubscriptionId: opts?.createdSubscriptionId ?? null,
        stripeCustomerId: opts?.stripeCustomerId ?? null,
        stripeSubscriptionId: opts?.stripeSubscriptionId ?? null,
        extra: opts?.extra,
      });
      return result;
    };

    /** Paso intermedio (no termina la mutación); útil para depurar MSI / attach. */
    const writeTraceLog = async (
      step: string,
      message: string,
      extra?: Record<string, unknown>,
    ) => {
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step,
        success: true,
        message,
        subscriptionId: null,
        paymentId: null,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: logPlanId ?? null,
        stripeCustomerId: null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        extra,
      });
    };

    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_KEY_MISSING, {
          success: false,
          message: "STRIPE_SECRET_KEY no configurada",
          subscriptionId: null,
          paymentId: null,
        });
      }

      // 1. Find user by email (with stripeCustomerId and company)
      const user = (await context.sudo().query.User.findOne({
        where: { email: input.email.trim() },
        query:
          "id name email stripeCustomerId referredBy { id } company { id plan { id name cost frequency leadLimit currency planFeatures stripePriceId stripeProductId referralUpfrontCommissionPct referralRecurringCommissionPct } }",
      })) as {
        id: string;
        name?: string | null;
        email?: string | null;
        stripeCustomerId?: string | null;
        referredBy?: { id: string } | null;
        company?: {
          id: string;
          plan?: (PlanRecord & {
            referralUpfrontCommissionPct?: number | null;
            referralRecurringCommissionPct?: number | null;
          }) | null;
        } | null;
      } | null;

      if (!user) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.USER_NOT_FOUND, {
          success: false,
          message: "Usuario no encontrado con ese email",
          subscriptionId: null,
          paymentId: null,
        });
      }

      logUserId = user.id;

      // 2. Ensure user has Stripe customer ID
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
          subscriptionId: null,
          paymentId: null,
        });
      }

      logCompanyId = company.id;

      // 3. Resolve plan (input.planId or company.plan) — must have stripePriceId (recurring in Stripe)
      let plan: (PlanRecord & {
        referralUpfrontCommissionPct?: number | null;
        referralRecurringCommissionPct?: number | null;
      }) | null = company.plan ?? null;
      if (input.planId) {
        const planRecord = await context.sudo().query.SaasPlan.findOne({
          where: { id: input.planId },
          query:
            "id name cost frequency leadLimit currency planFeatures stripePriceId stripeProductId referralUpfrontCommissionPct referralRecurringCommissionPct",
        });
        plan = planRecord as typeof plan;
      }
      if (!plan?.id) {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_PLAN_RESOLVED, {
          success: false,
          message: "Indica un plan (planId) o asigna un plan a la empresa",
          subscriptionId: null,
          paymentId: null,
        });
      }

      logPlanId = plan.id;

      const stripePriceId = plan.stripePriceId ?? null;
      if (!stripePriceId || typeof stripePriceId !== "string") {
        return await finish(SAAS_SUBSCRIPTION_LOG_STEP.NO_STRIPE_PRICE_ID, {
          success: false,
          message:
            "El plan no tiene un Stripe Price ID configurado. Crea un Price recurrente en Stripe y asigna stripePriceId al plan.",
          subscriptionId: null,
          paymentId: null,
        });
      }

      const planCost = plan.cost ?? 0;
      const roundedTotalBack = parseFloat(Number(planCost).toFixed(2));
      const roundedTotalFront = parseFloat(Number(input.total).toFixed(2));
      const difference = Math.abs(roundedTotalFront - roundedTotalBack);
      if (difference > 0.01) {
        return await finish(
          SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH,
          {
            success: false,
            message: `El total no coincide con el plan. Esperado: ${roundedTotalBack}, recibido: ${roundedTotalFront}. Recarga la página e intenta de nuevo.`,
            subscriptionId: null,
            paymentId: null,
          },
          {
            extra: {
              expectedTotal: roundedTotalBack,
              receivedTotal: roundedTotalFront,
            },
          },
        );
      }

      const checkoutSubscriptionId = input.stripeSubscriptionId?.trim() || null;
      const prepaidPaymentIntentId = input.stripePaymentIntentId?.trim() || null;
      const checkoutPath = prepaidPaymentIntentId
        ? "msi_prepaid_pi"
        : checkoutSubscriptionId
          ? "checkout_subscription"
          : "legacy_payment_method";
      let stripePaymentMethodId: string;

      await writeTraceLog("CREATE_SUBSCRIPTION_CHECKOUT_PATH", "Ruta de checkout resuelta", {
        checkoutPath,
        stripePaymentIntentId: prepaidPaymentIntentId,
        stripeSubscriptionIdInput: checkoutSubscriptionId,
        stripeCustomerId: user.stripeCustomerId ?? null,
      });

      if (prepaidPaymentIntentId) {
        const pi = await Stripe.paymentIntents.retrieve(prepaidPaymentIntentId, {
          expand: ["payment_method"],
        });

        if (pi.status !== "succeeded") {
          return await finish(
            SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
            {
              success: false,
              message:
                "El pago no se completó. Verifica tu tarjeta e intenta de nuevo.",
              subscriptionId: null,
              paymentId: null,
            },
            {
              stripeCustomerId: user.stripeCustomerId ?? null,
              extra: {
                checkoutPath,
                paymentIntent: buildPaymentIntentSnapshot(pi),
              },
            },
          );
        }

        if (
          pi.metadata?.planId !== plan.id ||
          pi.metadata?.companyId !== company.id
        ) {
          return await finish(
            SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
            {
              success: false,
              message: "El pago no coincide con el plan seleccionado.",
              subscriptionId: null,
              paymentId: null,
            },
            {
              stripeCustomerId: user.stripeCustomerId ?? null,
              extra: {
                checkoutPath,
                paymentIntent: buildPaymentIntentSnapshot(pi),
                expectedPlanId: plan.id,
                expectedCompanyId: company.id,
              },
            },
          );
        }

        const expectedCents = Math.round(roundedTotalBack * 100);
        if (
          pi.amount !== expectedCents ||
          (pi.currency ?? "").toLowerCase() !== "mxn"
        ) {
          return await finish(
            SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH,
            {
              success: false,
              message: "El monto pagado no coincide con el plan.",
              subscriptionId: null,
              paymentId: null,
            },
            {
              stripeCustomerId: user.stripeCustomerId ?? null,
              extra: {
                checkoutPath,
                paymentIntent: buildPaymentIntentSnapshot(pi),
                expectedCents,
              },
            },
          );
        }

        stripePaymentMethodId = resolvePaymentMethodId(pi.payment_method) ?? "";

        if (!stripePaymentMethodId) {
          return await finish(
            SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND,
            {
              success: false,
              message: "No se encontró el método de pago del cobro.",
              subscriptionId: null,
              paymentId: null,
            },
            {
              stripeCustomerId: user.stripeCustomerId ?? null,
              extra: {
                checkoutPath,
                paymentIntent: buildPaymentIntentSnapshot(pi),
              },
            },
          );
        }

        const pmSnapshotBeforeAttach = await buildPaymentMethodSnapshot(
          stripePaymentMethodId,
        );

        await writeTraceLog(
          SAAS_SUBSCRIPTION_LOG_STEP.MSI_PI_VALIDATED,
          "PaymentIntent MSI validado antes de adjuntar PM",
          {
            checkoutPath,
            paymentIntent: buildPaymentIntentSnapshot(pi),
            paymentMethod: pmSnapshotBeforeAttach,
            targetStripeCustomerId: user.stripeCustomerId ?? null,
            piCustomerMatchesUser:
              pi.customer != null && pi.customer === user.stripeCustomerId,
            pmAlreadyOnCustomer:
              pmSnapshotBeforeAttach.customer != null &&
              pmSnapshotBeforeAttach.customer === user.stripeCustomerId,
          },
        );

        const pmCustomerId =
          typeof pmSnapshotBeforeAttach.customer === "string"
            ? pmSnapshotBeforeAttach.customer
            : null;

        if (pmCustomerId === user.stripeCustomerId) {
          await writeTraceLog(
            SAAS_SUBSCRIPTION_LOG_STEP.MSI_PM_ATTACH_SKIPPED_ALREADY_ATTACHED,
            "PM ya pertenece al customer; se omite attach",
            {
              paymentMethodId: stripePaymentMethodId,
              stripeCustomerId: user.stripeCustomerId,
            },
          );
        } else {
          await writeTraceLog(
            SAAS_SUBSCRIPTION_LOG_STEP.MSI_PM_ATTACH_ATTEMPT,
            "Intentando adjuntar PM al customer",
            {
              paymentMethodId: stripePaymentMethodId,
              paymentMethod: pmSnapshotBeforeAttach,
              stripeCustomerId: user.stripeCustomerId,
              piCustomer: pi.customer ?? null,
            },
          );

          try {
            await Stripe.paymentMethods.attach(stripePaymentMethodId, {
              customer: user.stripeCustomerId!,
            });
          } catch (attachErr: unknown) {
            const stripeError = serializeStripeError(attachErr);
            const msg =
              attachErr instanceof Error ? attachErr.message : String(attachErr);
            const alreadyAttached = msg
              .toLowerCase()
              .includes("already been attached");

            if (!alreadyAttached) {
              await writeSaasSubscriptionLog(context, {
                startedAt,
                input: logInput,
                step: SAAS_SUBSCRIPTION_LOG_STEP.MSI_PM_ATTACH_FAILED,
                success: false,
                message: msg,
                subscriptionId: null,
                paymentId: null,
                userId: logUserId ?? null,
                companyId: logCompanyId ?? null,
                planId: logPlanId ?? null,
                stripeCustomerId: user.stripeCustomerId ?? null,
                extra: {
                  checkoutPath,
                  stripeError,
                  paymentIntent: buildPaymentIntentSnapshot(pi),
                  paymentMethod: await buildPaymentMethodSnapshot(stripePaymentMethodId),
                  hint:
                    "Si code indica PM no reusable: el PI debió crearse con customer + setup_future_usage=off_session (beginCompanySubscription).",
                },
              });
              throw attachErr;
            }

            await writeTraceLog(
              SAAS_SUBSCRIPTION_LOG_STEP.MSI_PM_ATTACH_SKIPPED_ALREADY_ATTACHED,
              "Attach devolvió already attached; se continúa",
              { stripeError, paymentMethodId: stripePaymentMethodId },
            );
          }
        }

        await Stripe.customers.update(user.stripeCustomerId!, {
          invoice_settings: {
            default_payment_method: stripePaymentMethodId,
          },
        });

        const trialEnd = computeTrialEndUnix(plan.frequency);
        await writeTraceLog(
          "MSI_SUBSCRIPTION_CREATE_ATTEMPT",
          "Creando suscripción Stripe con trial tras MSI",
          {
            stripeCustomerId: user.stripeCustomerId,
            stripePriceId,
            defaultPaymentMethodId: stripePaymentMethodId,
            trialEnd,
          },
        );

        try {
          prepaidMsiSubscription = await Stripe.subscriptions.create({
            customer: user.stripeCustomerId!,
            items: [{ price: stripePriceId }],
            default_payment_method: stripePaymentMethodId,
            trial_end: trialEnd,
            metadata: { companyId: company.id, planId: plan.id },
          });
        } catch (subErr: unknown) {
          const subMessage =
            subErr instanceof Error ? subErr.message : String(subErr);
          await writeSaasSubscriptionLog(context, {
            startedAt,
            input: logInput,
            step: SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
            success: false,
            message: subMessage,
            subscriptionId: null,
            paymentId: null,
            userId: logUserId ?? null,
            companyId: logCompanyId ?? null,
            planId: logPlanId ?? null,
            stripeCustomerId: user.stripeCustomerId ?? null,
            extra: {
              checkoutPath,
              phase: "subscriptions.create_after_msi",
              stripeError: serializeStripeError(subErr),
              defaultPaymentMethodId: stripePaymentMethodId,
              trialEnd,
            },
          });
          throw subErr;
        }

        stripeSubscriptionId = prepaidMsiSubscription.id;

        await writeTraceLog(
          SAAS_SUBSCRIPTION_LOG_STEP.MSI_SUBSCRIPTION_CREATED,
          "Suscripción Stripe creada tras MSI",
          {
            stripeSubscriptionId: prepaidMsiSubscription.id,
            status: prepaidMsiSubscription.status,
            trialEnd: prepaidMsiSubscription.trial_end ?? null,
          },
        );
      } else if (checkoutSubscriptionId) {
        const existingStripeSub = await Stripe.subscriptions.retrieve(
          checkoutSubscriptionId,
          { expand: ["default_payment_method"] },
        );

        if (
          existingStripeSub.metadata?.companyId !== company.id ||
          existingStripeSub.metadata?.planId !== plan.id
        ) {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR, {
            success: false,
            message: "La suscripción de pago no coincide con el plan seleccionado.",
            subscriptionId: null,
            paymentId: null,
          });
        }

        const subStatus = existingStripeSub.status;
        if (subStatus !== "active" && subStatus !== "trialing") {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR, {
            success: false,
            message:
              "El pago no se completó. Verifica tu tarjeta e intenta de nuevo.",
            subscriptionId: null,
            paymentId: null,
          });
        }

        const defaultPm = existingStripeSub.default_payment_method;
        if (typeof defaultPm === "string") {
          stripePaymentMethodId = defaultPm;
        } else if (
          defaultPm &&
          typeof defaultPm === "object" &&
          "id" in defaultPm &&
          typeof (defaultPm as { id: unknown }).id === "string"
        ) {
          stripePaymentMethodId = (defaultPm as { id: string }).id;
        } else {
          stripePaymentMethodId = "";
        }

        if (!stripePaymentMethodId) {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND, {
            success: false,
            message: "No se encontró el método de pago de la suscripción.",
            subscriptionId: null,
            paymentId: null,
          });
        }

        stripeSubscriptionId = existingStripeSub.id;
      } else {
        if (!input.paymentMethodId) {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND, {
            success: false,
            message: "Método de pago requerido",
            subscriptionId: null,
            paymentId: null,
          });
        }

        // 4. Get SaasPaymentMethod (legacy CardElement flow)
        const paymentMethod = (await context.sudo().query.SaasPaymentMethod.findOne({
          where: { id: input.paymentMethodId },
          query: "id stripePaymentMethodId",
        })) as { id: string; stripePaymentMethodId: string | null } | null;

        if (!paymentMethod?.stripePaymentMethodId) {
          return await finish(SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND, {
            success: false,
            message: "Método de pago no encontrado",
            subscriptionId: null,
            paymentId: null,
          });
        }

        stripePaymentMethodId = paymentMethod.stripePaymentMethodId;

        // 5. Attach payment method to customer and set as default (required for subscription first charge)
        try {
          await Stripe.paymentMethods.attach(stripePaymentMethodId, {
            customer: user.stripeCustomerId!,
          });
        } catch (attachErr: unknown) {
          const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
          if (!msg.toLowerCase().includes("already been attached")) throw attachErr;
        }
        await Stripe.customers.update(user.stripeCustomerId!, {
          invoice_settings: {
            default_payment_method: stripePaymentMethodId,
          },
        });
      }

      // 6. Cancel any existing active or trialing subscription for this company (change of plan)
      const existingSubs = await context.sudo().query.SaasCompanySubscription.findMany({
        where: {
          company: { id: { equals: company.id } },
          status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
        },
        query: "id stripeSubscriptionId planCost",
      }) as { id: string; stripeSubscriptionId: string | null; planCost: number | null }[];

      // Consider as "previous subscription" only those with cost > 0 (ignore free / trial-only plans)
      const hadPreviousActiveSubscription = existingSubs.some(
        (sub) => sub.planCost != null && sub.planCost > 0,
      );
      for (const prev of existingSubs) {
        if (
          checkoutSubscriptionId &&
          prev.stripeSubscriptionId === checkoutSubscriptionId
        ) {
          continue;
        }
        if (prev.stripeSubscriptionId) {
          await Stripe.subscriptions.cancel(prev.stripeSubscriptionId);
        }
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: prev.id },
          data: { status: SUBSCRIPTION_STATUS.CANCELLED },
        });


        // Cancel all pending referral commissions tied to the previous subscription.
        // This is required for "change of plan" flows because subscriptionStatus only checks the latest ACTIVE/TRIALING subscription.
        const pendingCommissions =
          await context.sudo().query.SaasReferralCommission.findMany({
            where: {
              subscription: { id: { equals: prev.id } },
              status: { equals: "PENDING" },
            },
            query: "id",
          });


        for (const commission of pendingCommissions as { id: string }[]) {
          await context.sudo().query.SaasReferralCommission.updateOne({
            where: { id: commission.id },
            data: {
              status: "CANCELLED",
              notes:
                "Comisión cancelada por cambio de plan: la suscripción fue cancelada.",
            },
          });
        }
      }

      // 7. Create Stripe Subscription (legacy), MSI prepago, o reutilizar checkout incompleto
      let stripeSubscription: Awaited<ReturnType<typeof createStripeSubscription>>;
      if (prepaidMsiSubscription) {
        stripeSubscription = prepaidMsiSubscription;
      } else if (checkoutSubscriptionId && stripeSubscriptionId) {
        stripeSubscription = await Stripe.subscriptions.retrieve(stripeSubscriptionId, {
          expand: ["latest_invoice"],
        });
      } else {
        stripeSubscription = await createStripeSubscription({
          customerId: user.stripeCustomerId!,
          priceId: stripePriceId,
          defaultPaymentMethodId: stripePaymentMethodId,
          metadata: { companyId: company.id, planId: plan.id },
        });
        stripeSubscriptionId = stripeSubscription.id;
      }
      const subStatus = (stripeSubscription.status as string) ?? "active";
      const today = new Date().toISOString().slice(0, 10);

      let periodEnd: string;
      let periodEndSource: "stripe" | "today_missing_end" = "today_missing_end";
      if (stripeSubscription.current_period_end && typeof stripeSubscription.current_period_end === "number") {
        periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString().slice(0, 10);
        periodEndSource = "stripe";
      } else {
        periodEnd = today;
      }
      let fallbackBranch: "annual" | "weekly" | "monthly_default" | null = null;
      if (periodEnd <= today) {
        const [y, m, day] = today.split("-").map(Number);
        const d = new Date(y, m - 1, day);
        const freq = (plan.frequency ?? "").toLowerCase();
        if (freq === PLAN_FREQUENCY.ANNUAL) {
          d.setFullYear(d.getFullYear() + 1);
          fallbackBranch = "annual";
        } else if (freq === PLAN_FREQUENCY.WEEKLY) {
          d.setDate(d.getDate() + 7);
          fallbackBranch = "weekly";
        } else {
          d.setMonth(d.getMonth() + 1);
          fallbackBranch = "monthly_default";
        }
        periodEnd = d.toISOString().slice(0, 10);
      }


      // 8. Create SaasCompanySubscription (snapshot + stripeSubscriptionId to check if still active)
      const subscription = await context.sudo().query.SaasCompanySubscription.createOne({
        data: {
          company: { connect: { id: company.id } },
          planName: plan.name ?? "",
          planCost: planCost,
          planFrequency: plan.frequency ?? "",
          planLeadLimit: plan.leadLimit ?? 0,
          planCurrency: plan.currency ?? "",
          planStripePriceId: stripePriceId,
          planFeatures: plan.planFeatures ?? undefined,
          status:
            subStatus === "active" || subStatus === "trialing"
              ? SUBSCRIPTION_STATUS.ACTIVE
              : subStatus,
          activatedAt: today,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscription.id,
        },
        query: "id",
      });
      const subscriptionId = (subscription as { id: string } | null)?.id;

      // 9.1. Generate referral commissions only for the first subscription (no previous active/trialing)
      const referrer = user.referredBy;
      const upfrontPct = plan.referralUpfrontCommissionPct ?? 0;
      const recurringPct = plan.referralRecurringCommissionPct ?? 0;

      if (
        !hadPreviousActiveSubscription &&
        referrer &&
        (upfrontPct > 0 || recurringPct > 0) &&
        subscriptionId
      ) {
        const baseCost = planCost;
        const currency = plan.currency ?? "mxn";
        const [actYear, actMonth, actDay] = today.split("-").map(Number);
        const activationDate = new Date(actYear, actMonth - 1, actDay);

        const addMonths = (date: Date, months: number) => {
          const d = new Date(date);
          d.setMonth(d.getMonth() + months);
          return d;
        };

        // Upfront commission (periodIndex = 0)
        if (upfrontPct > 0) {
          const upfrontAmount = Math.round(baseCost * (upfrontPct / 100));
          await context.sudo().query.SaasReferralCommission.createOne({
            data: {
              referrer: { connect: { id: referrer.id } },
              referredUser: { connect: { id: user.id } },
              company: { connect: { id: company.id } },
              subscription: { connect: { id: subscriptionId } },
              plan: { connect: { id: plan.id } },
              type: "UPFRONT",
              percentage: upfrontPct,
              amount: upfrontAmount,
              currency,
              periodIndex: 0,
              periodStart: today,
              periodEnd: today,
              status: "PENDING",
            },
          });
        }

        // Recurring commissions (e.g., 12 months) as pending
        if (recurringPct > 0) {
          const recurringAmount = Math.round(baseCost * (recurringPct / 100));
          const monthsToGenerate = 12;

          for (let i = 1; i <= monthsToGenerate; i++) {
            const periodStartDate = addMonths(activationDate, i - 1);
            const periodEndDate = addMonths(activationDate, i);
            const periodStartStr = periodStartDate
              .toISOString()
              .slice(0, 10);
            const periodEndPlus5 = new Date(periodEndDate);
            periodEndPlus5.setDate(periodEndPlus5.getDate() + 5);
            const periodEndStr = periodEndPlus5.toISOString().slice(0, 10);

            await context.sudo().query.SaasReferralCommission.createOne({
              data: {
                referrer: { connect: { id: referrer.id } },
                referredUser: { connect: { id: user.id } },
                company: { connect: { id: company.id } },
                subscription: { connect: { id: subscriptionId } },
                plan: { connect: { id: plan.id } },
                type: "RECURRING",
                percentage: recurringPct,
                amount: recurringAmount,
                currency,
                periodIndex: i,
                periodStart: periodStartStr,
                periodEnd: periodEndStr,
                status: "PENDING",
              },
            });
          }
        }
      }

      // 9. Update company.plan to the new plan
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: company.id },
        data: { plan: { connect: { id: plan.id } } },
      });

      return await finish(
        SAAS_SUBSCRIPTION_LOG_STEP.SUCCESS,
        {
          success: true,
          message:
            "Suscripción creada correctamente. El cobro recurrente usará el método de pago guardado.",
          subscriptionId: subscriptionId ?? null,
          paymentId: null,
        },
        {
          createdSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
        },
      );
    } catch (e: unknown) {
      if (stripeSubscriptionId) {
        try {
          await Stripe.subscriptions.cancel(stripeSubscriptionId);
        } catch (_) {}
      }
      const message =
        e instanceof Error ? e.message : "Error de comunicación con el servidor. Intenta de nuevo.";
      await writeSaasSubscriptionLog(context, {
        startedAt,
        input: logInput,
        step: SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR,
        success: false,
        message,
        subscriptionId: null,
        paymentId: null,
        userId: logUserId ?? null,
        companyId: logCompanyId ?? null,
        planId: logPlanId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        extra: {
          errorName: e instanceof Error ? e.name : "unknown",
          stripeError: serializeStripeError(e),
          checkoutPath:
            input.stripePaymentIntentId?.trim()
              ? "msi_prepaid_pi"
              : input.stripeSubscriptionId?.trim()
                ? "checkout_subscription"
                : "legacy_payment_method",
          stripePaymentIntentId: input.stripePaymentIntentId?.trim() ?? null,
          stripeSubscriptionIdInput: input.stripeSubscriptionId?.trim() ?? null,
        },
      });
      return {
        success: false,
        message,
        subscriptionId: null,
        paymentId: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
