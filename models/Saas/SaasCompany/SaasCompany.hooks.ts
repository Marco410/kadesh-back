import { SUBSCRIPTION_STATUS } from "../SaasCompanySubscription/constants";
import { Role } from "../../Role/constants";
import { TRIAL_DAYS_FREE_PLAN } from "../../../utils/constants/constants";

/** On SaasCompany create: default "Ventas" workspace, assign free plan (cost = 0), SaasCompanySubscription, and Admin (Company) role to the creator. */
export const saasCompanySubscriptionHook = {
  afterOperation: async ({ operation, item, context }: any) => {
    if (operation !== "create" || !item?.id) return;

    try {
      const session = context.session as { data?: { id: string } } | undefined;
      const createdByUserId = session?.data?.id;
      if (createdByUserId) {
        const [adminCompanyRole] = await context.sudo().query.Role.findMany({
          where: { name: { equals: Role.ADMIN_COMPANY } },
          take: 1,
          query: "id",
        });
        if (adminCompanyRole) {
          const user = await context.sudo().query.User.findOne({
            where: { id: createdByUserId },
            query: "id roles { id }",
          }) as { id: string; roles?: { id: string }[] } | null;
          const alreadyHasRole = user?.roles?.some((r) => r.id === (adminCompanyRole as { id: string }).id);
          if (!alreadyHasRole) {
            await context.sudo().query.User.updateOne({
              where: { id: createdByUserId },
              data: { roles: { connect: { id: (adminCompanyRole as { id: string }).id } } },
            });
          }
        }
      }

      await context.sudo().query.SaasWorkspace.createOne({
        data: {
          name: "Ventas",
          company: { connect: { id: item.id } },
          ...(createdByUserId && {
            members: { connect: [{ id: createdByUserId }] },
          }),
        },
      });

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
      const trialDaysFromNow = new Date();
      trialDaysFromNow.setDate(trialDaysFromNow.getDate() + TRIAL_DAYS_FREE_PLAN);
      const periodEnd = trialDaysFromNow.toISOString().slice(0, 10);

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
          status: SUBSCRIPTION_STATUS.TRIALING,
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
