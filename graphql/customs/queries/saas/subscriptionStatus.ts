import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { ACTIVITY_SOURCE } from "../../../../models/ActivityEvent/constants";
import { getStripeSubscription } from "../../../../utils/saas/stripeSubscription";
import {
  applySubscriptionState,
  stripeStatusToLocal,
  unixToDay,
} from "../../../../utils/saas/stripeSubscriptionSync";
import { getFreePlanTrialInfo } from "../../../../utils/saas/freePlanTrial";
import {
  denyOtherCompanyMessage,
  resolveAuthorizedCompanyId,
} from "../../../../utils/access/tenant";

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
    const session = context.session;
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

    const companyIdToUse = resolveAuthorizedCompanyId(session, companyId);

    if (!companyIdToUse) {
      return {
        success: false,
        message: companyId
          ? denyOtherCompanyMessage()
          : "No se encontró un negocio asignado.",
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

    const localRef = {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      companyId: companyIdToUse,
      planName: sub.planName,
    };

    if (sub.stripeSubscriptionId) {
      const stripeInfo = await getStripeSubscription(sub.stripeSubscriptionId);

      if (stripeInfo.unavailable) {
        // Stripe no respondió: se confía en el estado local. Antes un error de red o un 429
        // se leía como "cancelada" y el cliente perdía el acceso sin poder recuperarlo.
        subscriptionActive =
          sub.status === SUBSCRIPTION_STATUS.ACTIVE || sub.status === SUBSCRIPTION_STATUS.TRIALING;
      } else {
        subscriptionActive = stripeInfo.active;
        const stripePeriodEnd = unixToDay(stripeInfo.currentPeriodEnd);
        if (stripePeriodEnd) periodEnd = stripePeriodEnd;
        newStatus = stripeStatusToLocal(stripeInfo.status);

        // Guarda estado y fin de periodo si cambiaron (renovaciones incluidas), cancela comisiones
        // pendientes si dejó de pagar y registra el cambio de estado.
        await applySubscriptionState(
          context,
          localRef,
          { status: newStatus, currentPeriodEnd: stripePeriodEnd },
          { source: ACTIVITY_SOURCE.SYSTEM, reason: "panel_check" },
        );
      }
    } else if (isFreePlan && sub.activatedAt) {
      const { trialEnd: trialEndStr, isExpired } = getFreePlanTrialInfo(
        sub.activatedAt,
      );

      if (!trialEndStr) {
        periodEnd = null;
        subscriptionActive = false;
      } else if (isExpired) {
        newStatus = SUBSCRIPTION_STATUS.PAST_DUE;
        await applySubscriptionState(
          context,
          localRef,
          { status: newStatus, currentPeriodEnd: null },
          { source: ACTIVITY_SOURCE.SYSTEM, reason: "trial_expired" },
        );
        periodEnd = trialEndStr;
        subscriptionActive = false;
      } else {
        periodEnd = trialEndStr;
        subscriptionActive = true;
      }
    } else {
      subscriptionActive = newStatus === SUBSCRIPTION_STATUS.ACTIVE || newStatus === SUBSCRIPTION_STATUS.TRIALING;
    }

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
