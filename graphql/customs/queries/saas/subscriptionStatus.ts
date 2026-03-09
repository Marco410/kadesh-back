import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { getStripeSubscription } from "../../../../utils/saas/stripeSubscription";

const TRIAL_MONTHS_FREE_PLAN = 1;

/** Map Stripe subscription status to our SUBSCRIPTION_STATUS */
function stripeStatusToLocal(stripeStatus: string | null): string {
  if (!stripeStatus) return SUBSCRIPTION_STATUS.CANCELLED;
  const s = stripeStatus.toLowerCase();
  if (s === "active") return SUBSCRIPTION_STATUS.ACTIVE;
  if (s === "trialing") return SUBSCRIPTION_STATUS.TRIALING;
  if (s === "past_due") return SUBSCRIPTION_STATUS.PAST_DUE;
  if (s === "canceled" || s === "cancelled") return SUBSCRIPTION_STATUS.CANCELLED;
  if (s === "unpaid") return SUBSCRIPTION_STATUS.UNPAID;
  return s;
}

/**
 * Días desde hoy (inicio del día local) hasta el fin del día de la fecha indicada.
 * Parsea YYYY-MM-DD como fecha local para evitar que UTC reste un día en zonas como México.
 */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diffMs = endOfDay.getTime() - startOfToday.getTime();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return days < 0 ? 0 : days;
}

const typeDefs = `
  type SubscriptionData {
    id: ID
    activatedAt: String
    planCost: Float
    planCurrency: String
    planFrequency: String
    planLeadLimit: Int
    planName: String
    planFeatures: JSON
    status: String
    stripeCustomerId: String
    stripeSubscriptionId: String
    currentPeriodEnd: String
  }

  type SubscriptionStatusResult {
    success: Boolean!
    message: String
    daysUntilNextBilling: Int
    subscriptionActive: Boolean
    subscription: SubscriptionData
  }

  type Query {
    subscriptionStatus(companyId: ID): SubscriptionStatusResult
  }
`;

const definition = `
  subscriptionStatus(companyId: ID): SubscriptionStatusResult
`;

const resolver = {
  subscriptionStatus: async (
    _root: unknown,
    { companyId }: { companyId?: string | null },
    context: KeystoneContext,
  ) => {
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;

    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para ver el estado de la suscripción",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null,
      };
    }

    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }",
    });

    const userCompany = (user as { company?: { id: string; name?: string } | null })?.company;
    const companyIdToUse = companyId ?? userCompany?.id;

    if (!companyIdToUse) {
      return {
        success: false,
        message: "No se encontró un negocio asignado.",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null,
      };
    }

    const [subscription] = await context.sudo().query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: companyIdToUse } },
        status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query:
        "id status activatedAt currentPeriodEnd planCost planCurrency planFrequency planLeadLimit planName planFeatures stripeCustomerId stripeSubscriptionId",
    });

    if (!subscription) {
      return {
        success: true,
        message: "Tu negocio no tiene una suscripción activa. Contrata o activa una suscripción para poder obtener más clientes.",
        daysUntilNextBilling: null,
        subscriptionActive: false,
        subscription: null,
      };
    }

    const sub = subscription as {
      id: string;
      status: string;
      activatedAt: string | null;
      currentPeriodEnd: string | null;
      planCost: number | null;
      planCurrency: string | null;
      planFrequency: string | null;
      planLeadLimit: number | null;
      planName: string | null;
      planFeatures: unknown;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
    };

    const isFreePlan = sub.planCost != null && sub.planCost <= 0;
    let newStatus = sub.status;
    let periodEnd: string | null = sub.currentPeriodEnd;
    let subscriptionActive = false;

    if (sub.stripeSubscriptionId) {
      const stripeInfo = await getStripeSubscription(sub.stripeSubscriptionId);
      subscriptionActive = stripeInfo.active;

      if (stripeInfo.currentPeriodEnd) {
        periodEnd = new Date(stripeInfo.currentPeriodEnd * 1000).toISOString().slice(0, 10);
      }

      const mappedStatus = stripeStatusToLocal(stripeInfo.status);
      if (mappedStatus !== sub.status) {
        newStatus = mappedStatus;
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: sub.id },
          data: {
            status: newStatus,
            ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
          },
        });
      }
    } else if (isFreePlan && sub.activatedAt) {
      const [y, m, d] = sub.activatedAt.split("-").map(Number);
      const trialEnd = new Date(y, m - 1 + TRIAL_MONTHS_FREE_PLAN, d);
      const trialEndStr = trialEnd.toISOString().slice(0, 10);
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      if (trialEndStr < todayStr) {
        newStatus = SUBSCRIPTION_STATUS.PAST_DUE;
        await context.sudo().query.SaasCompanySubscription.updateOne({
          where: { id: sub.id },
          data: { status: newStatus },
        });
        periodEnd = trialEndStr;
        subscriptionActive = false;
      } else {
        periodEnd = trialEndStr;
        subscriptionActive = true;
      }
    } else {
      subscriptionActive = newStatus === SUBSCRIPTION_STATUS.ACTIVE || newStatus === SUBSCRIPTION_STATUS.TRIALING;
    }

    console.log("periodEnd", periodEnd);

    const daysUntilNextBilling = periodEnd ? daysUntil(periodEnd) : null;

    const subscriptionData = {
      id: sub.id,
      activatedAt: sub.activatedAt,
      planCost: sub.planCost,
      planCurrency: sub.planCurrency,
      planFrequency: sub.planFrequency,
      planLeadLimit: sub.planLeadLimit,
      planName: sub.planName,
      planFeatures: sub.planFeatures,
      status: newStatus,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      currentPeriodEnd: periodEnd,
    };

    return {
      success: true,
      message: null,
      daysUntilNextBilling,
      subscriptionActive,
      subscription: subscriptionData,
    };
  },
};

export default { typeDefs, definition, resolver };
