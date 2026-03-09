import { SUBSCRIPTION_STATUS } from "../SaasCompanySubscription/constants";

/** On SaasCompany create: assign free plan (cost = 0) and create a SaasCompanySubscription. */
export const saasCompanySubscriptionHook = {
  afterOperation: async ({ operation, item, context }: any) => {
    if (operation !== "create" || !item?.id) return;

    try {
      const [freePlan] = await context.sudo().query.SaasPlan.findMany({
        where: { cost: { equals: 0 } },
        take: 1,
        query:
          "id name cost frequency leadLimit stripePriceId currency planFeatures",
      });

      if (!freePlan) {
        console.warn(
          "SaasCompany created but no free plan (cost=0) found; skipping subscription.",
        );
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      const periodEnd = oneMonthFromNow.toISOString().slice(0, 10);

      await context.sudo().query.SaasCompanySubscription.createOne({
        data: {
          company: { connect: { id: item.id } },
          planName: freePlan.name,
          planCost: freePlan.cost,
          planFrequency: freePlan.frequency,
          planLeadLimit: freePlan.leadLimit,
          planStripePriceId: freePlan.stripePriceId ?? undefined,
          planCurrency: freePlan.currency ?? "mxn",
          planFeatures: freePlan.planFeatures ?? undefined,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          activatedAt: today,
          currentPeriodEnd: periodEnd,
        },
      });

      await context.sudo().query.SaasCompany.updateOne({
        where: { id: item.id },
        data: {
          plan: { connect: { id: freePlan.id } },
          subscriptionStartedAt: today,
        },
      });
    } catch (error) {
      console.error("Error creating free subscription for SaasCompany:", error);
    }
  },
};
