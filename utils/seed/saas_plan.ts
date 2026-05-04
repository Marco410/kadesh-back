import { KeystoneContext } from "@keystone-6/core/types";
import { PLAN_FREQUENCY } from "../../models/Saas/SaasPlan/constants";
import { getPlanFeatures } from "../../models/Saas/SaasPlan/getPlanFeatures";

const planFeaturesFree = getPlanFeatures();

const planFeaturesStarter = getPlanFeatures({
  lead_sync: true,
  crm: true,
  edit_lead_data: true,
  sales_activities: true,
  follow_up_tasks: true,
  proposals: true,
  add_own_leads: false,
  calendar_crm: false,
  sales_person_management: false,
  export_excel: false,
  sales_commission: false,
  assign_sales_person: false,
  upload_files: false,
  projects: false,
  quotations: false,
  workspaces: false,
});

const planFeaturesPro = getPlanFeatures({
  lead_sync: true,
  crm: true,
  edit_lead_data: true,
  sales_activities: true,
  follow_up_tasks: true,
  proposals: true,
  add_own_leads: true,
  calendar_crm: false,
  sales_person_management: true,
  export_excel: true,
  sales_commission: true,
  assign_sales_person: false,
  upload_files: false,
  projects: false,
  quotations: false,
  workspaces: false,
});

const planFeaturesAgency = getPlanFeatures();

async function upsertPlan(
  context: KeystoneContext,
  name: string,
  data: {
    name: string;
    cost: number;
    frequency: string;
    leadLimit: number;
    planFeatures: ReturnType<typeof getPlanFeatures>;
    stripePriceId?: string;
    stripeProductId?: string;
    bestSeller?: boolean;
    referralUpfrontCommissionPct?: number;
    referralRecurringCommissionPct?: number;
  },
): Promise<string> {
  const [existing] = await context.sudo().query.SaasPlan.findMany({
    where: { name: { equals: name } },
    query: "id",
    take: 1,
  });
  const payload = {
    name: data.name,
    cost: data.cost,
    frequency: data.frequency,
    leadLimit: data.leadLimit,
    planFeatures: data.planFeatures,
    ...(data.stripePriceId != null && { stripePriceId: data.stripePriceId }),
    ...(data.stripeProductId != null && {
      stripeProductId: data.stripeProductId,
    }),
    ...(data.bestSeller != null && { bestSeller: data.bestSeller }),
    ...(data.referralUpfrontCommissionPct != null && { referralUpfrontCommissionPct: data.referralUpfrontCommissionPct }),
    ...(data.referralRecurringCommissionPct != null && { referralRecurringCommissionPct: data.referralRecurringCommissionPct }),
  };
  if (existing) {
    await context.sudo().query.SaasPlan.updateOne({
      where: { id: (existing as { id: string }).id },
      data: payload,
    });
    return (existing as { id: string }).id;
  }
  const created = await context.sudo().query.SaasPlan.createOne({
    data: payload,
    query: "id",
  });
  return (created as { id: string }).id;
}

export async function createSaasPlan(
  context: KeystoneContext,
): Promise<string | null> {
  const freeId = await upsertPlan(context, "Free", {
    name: "Free",
    cost: 0,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 50,
    planFeatures: planFeaturesFree,
    referralUpfrontCommissionPct: 0,
    referralRecurringCommissionPct: 0,
  });

  await upsertPlan(context, "Starter", {
    name: "Starter",
    cost: 799,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 400,
    stripePriceId: "price_1TBQ0zQB4ei9YzRV6UzktPtz",
    stripeProductId: "prod_U7AkUsHqLHpNrL",
    planFeatures: planFeaturesStarter,
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Starter Anual", {
    name: "Starter Anual",
    cost: 7990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 400,
    stripePriceId: "price_1TJJW4QB4ei9YzRVzb83K81Q",
    stripeProductId: "prod_U7AkUsHqLHpNrL",
    planFeatures: planFeaturesStarter,
    referralUpfrontCommissionPct: 15,
    referralRecurringCommissionPct: 0,
  });

  await upsertPlan(context, "Pro", {
    name: "Pro",
    cost: 1699,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 1500,
    planFeatures: planFeaturesPro,
    bestSeller: true,
    stripePriceId: "price_1TBQ3EQB4ei9YzRVldT380Jw",
    stripeProductId: "prod_U7M6geL01RYWf5",
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Pro Anual", {
    name: "Pro Anual",
    cost: 16990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 1500,
    planFeatures: planFeaturesPro,
    bestSeller: true,
    stripePriceId: "price_1TJLRaQB4ei9YzRVir7xmiRC",
    stripeProductId: "prod_U7M6geL01RYWf5",
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Agencia", {
    name: "Agencia",
    cost: 3499,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 5000,
    planFeatures: planFeaturesAgency,
    stripePriceId: "price_1TBQ40QB4ei9YzRVf2kQEHQX",
    stripeProductId: "prod_U7N3RIsVzkxTB1",
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Agencia Anual", {
    name: "Agencia Anual",
    cost: 34990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 5000,
    planFeatures: planFeaturesAgency,
    stripePriceId: "price_1TJJQTQB4ei9YzRVq1JX8F13",
    stripeProductId: "prod_U7N3RIsVzkxTB1",
    referralUpfrontCommissionPct: 15,
    referralRecurringCommissionPct: 0,
  });

  console.log("✅ SaasPlans seeding complete.");
  return freeId;
}
