import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../models/Saas/SaasCompanySubscription/constants";
import { getFreePlanTrialInfo } from "../../../utils/saas/freePlanTrial";
import { getOrCreateMonthlyRecord } from "./monthly_record";

export type RemainingCreditsBlockingReason =
  | "no_subscription"
  | "free_plan_expired"
  | "no_lead_limit"
  | "lead_limit_too_low";

export type RemainingCreditsResult = {
  blockingReason: RemainingCreditsBlockingReason | null;
  remainingQuota: number;
  syncedCount: number;
  /** Total effective limit (planLeadLimit + extraCredits) */
  leadLimit: number | null;
  planLeadLimit: number | null;
  extraCredits: number;
  recordId: string | null;
  year: number;
  month: number;
};

export async function getRemainingCredits(
  context: KeystoneContext,
  companyId: string,
): Promise<RemainingCreditsResult> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const empty: RemainingCreditsResult = {
    blockingReason: null,
    remainingQuota: 0,
    syncedCount: 0,
    leadLimit: null,
    planLeadLimit: null,
    extraCredits: 0,
    recordId: null,
    year,
    month,
  };

  const [activeSubscription] = await context
    .sudo()
    .query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: companyId } },
        status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query: "id planLeadLimit planCost activatedAt newCreditsAdded",
    });

  if (!activeSubscription) {
    return { ...empty, blockingReason: "no_subscription" };
  }

  const sub = activeSubscription as {
    planLeadLimit: number | null;
    planCost?: number | null;
    activatedAt?: string | null;
    newCreditsAdded?: number | null;
  };

  const isFreePlan = sub.planCost != null && sub.planCost <= 0;
  if (isFreePlan && sub.activatedAt) {
    const { isExpired } = getFreePlanTrialInfo(sub.activatedAt);
    if (isExpired) {
      return { ...empty, blockingReason: "free_plan_expired", leadLimit: 0 };
    }
  }

  const planLeadLimit = sub.planLeadLimit ?? null;
  const extraCredits = sub.newCreditsAdded ?? 0;

  if (planLeadLimit === null) {
    return {
      ...empty,
      blockingReason: "no_lead_limit",
      planLeadLimit,
      extraCredits,
    };
  }

  if (planLeadLimit < 1 && extraCredits < 1) {
    return {
      ...empty,
      blockingReason: "lead_limit_too_low",
      planLeadLimit,
      extraCredits,
      leadLimit: planLeadLimit + extraCredits,
    };
  }

  const { id: recordId, syncedCount } = await getOrCreateMonthlyRecord(
    context,
    companyId,
    year,
    month,
  );

  const leadLimit = planLeadLimit + extraCredits;
  const remainingQuota = Math.max(0, leadLimit - syncedCount);

  console.log("leadLimit", leadLimit);
  console.log("syncedCount", syncedCount);
  console.log("extraCredits", extraCredits);
  console.log("planLeadLimit", planLeadLimit);

  return {
    blockingReason: null,
    remainingQuota,
    syncedCount,
    leadLimit,
    planLeadLimit,
    extraCredits,
    recordId,
    year,
    month,
  };
}
