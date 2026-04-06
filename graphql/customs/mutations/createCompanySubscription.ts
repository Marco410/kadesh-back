import { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../../../utils/intregrations/stripe";
import { SUBSCRIPTION_STATUS } from "../../../models/Saas/SaasCompanySubscription/constants";
import { PLAN_FREQUENCY } from "../../../models/Saas/SaasPlan/constants";

const typeDefs = `
  input CreateCompanySubscriptionInput {
    planId: ID!
    notes: String
    nameCard: String!
    email: String!
    paymentMethodId: String!
    total: String!
    paymentType: String!
    noDuplicatePaymentMethod: Boolean
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
        paymentMethodId: string;
        total: string;
        paymentType: string;
        noDuplicatePaymentMethod?: boolean;
      };
    },
    context: KeystoneContext
  ) => {
    let stripeSubscriptionId: string | undefined;

    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          success: false,
          message: "STRIPE_SECRET_KEY no configurada",
          subscriptionId: null,
          paymentId: null,
        };
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
        return {
          success: false,
          message: "Usuario no encontrado con ese email",
          subscriptionId: null,
          paymentId: null,
        };
      }

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
        return {
          success: false,
          message: "Tu usuario no tiene una empresa asignada",
          subscriptionId: null,
          paymentId: null,
        };
      }

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
        return {
          success: false,
          message: "Indica un plan (planId) o asigna un plan a la empresa",
          subscriptionId: null,
          paymentId: null,
        };
      }

      const stripePriceId = plan.stripePriceId ?? null;
      if (!stripePriceId || typeof stripePriceId !== "string") {
        return {
          success: false,
          message:
            "El plan no tiene un Stripe Price ID configurado. Crea un Price recurrente en Stripe y asigna stripePriceId al plan.",
          subscriptionId: null,
          paymentId: null,
        };
      }

      const planCost = plan.cost ?? 0;
      const roundedTotalBack = parseFloat(Number(planCost).toFixed(2));
      const roundedTotalFront = parseFloat(Number(input.total).toFixed(2));
      const difference = Math.abs(roundedTotalFront - roundedTotalBack);
      if (difference > 0.01) {
        return {
          success: false,
          message: `El total no coincide con el plan. Esperado: ${roundedTotalBack}, recibido: ${roundedTotalFront}. Recarga la página e intenta de nuevo.`,
          subscriptionId: null,
          paymentId: null,
        };
      }

      // 4. Get SaasPaymentMethod
      const paymentMethod = (await context.sudo().query.SaasPaymentMethod.findOne({
        where: { id: input.paymentMethodId },
        query: "id stripePaymentMethodId",
      })) as { id: string; stripePaymentMethodId: string | null } | null;

      if (!paymentMethod?.stripePaymentMethodId) {
        return {
          success: false,
          message: "Método de pago no encontrado",
          subscriptionId: null,
          paymentId: null,
        };
      }

      // 5. Attach payment method to customer and set as default (required for subscription first charge)
      try {
        await Stripe.paymentMethods.attach(paymentMethod.stripePaymentMethodId, {
          customer: user.stripeCustomerId!,
        });
      } catch (attachErr: unknown) {
        // already attached is ok
        const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
        if (!msg.toLowerCase().includes("already been attached")) throw attachErr;
      }
      await Stripe.customers.update(user.stripeCustomerId!, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripePaymentMethodId,
        },
      });

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
        if (prev.stripeSubscriptionId) {
          await Stripe.subscriptions.cancel(prev.stripeSubscriptionId);
        }
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: prev.id },
          data: { status: SUBSCRIPTION_STATUS.CANCELLED },
        });
      }

      // 7. Create Stripe Subscription (uses plan.stripePriceId — recurring; first invoice charged now)
      const stripeSubscription = await createStripeSubscription({
        customerId: user.stripeCustomerId!,
        priceId: stripePriceId,
        defaultPaymentMethodId: paymentMethod.stripePaymentMethodId,
        metadata: { companyId: company.id, planId: plan.id },
      });

      stripeSubscriptionId = stripeSubscription.id;
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

      return {
        success: true,
        message: "Suscripción creada correctamente. El cobro recurrente usará el método de pago guardado.",
        subscriptionId: subscriptionId ?? null,
        paymentId: null,
      };
    } catch (e: unknown) {
      if (stripeSubscriptionId) {
        try {
          await Stripe.subscriptions.cancel(stripeSubscriptionId);
        } catch (_) {}
      }
      const message =
        e instanceof Error ? e.message : "Error de comunicación con el servidor. Intenta de nuevo.";
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
