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
  calendar_crm: false,
  sales_person_management: false,
  sales_commission: false,
  assign_sales_person: false,
  upload_files: false,
  projects: false,
});

const planFeaturesPro = getPlanFeatures({
  lead_sync: true,
  crm: true,
  edit_lead_data: true,
  sales_activities: true,
  follow_up_tasks: true,
  proposals: true,
  calendar_crm: false,
  sales_person_management: false,
  sales_commission: false,
  assign_sales_person: false,
  upload_files: false,
  projects: false,
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
    ...(data.stripeProductId != null && { stripeProductId: data.stripeProductId }),
    ...(data.bestSeller != null && { bestSeller: data.bestSeller }),
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
  });

  await upsertPlan(context, "Starter", {
    name: "Starter",
    cost: 499,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 400,
    stripePriceId: "price_1T8wP9QB4ei9YzRVJvhOHUnJ",
    stripeProductId: "prod_U7AkUsHqLHpNrL",
    planFeatures: planFeaturesStarter,
  });

  await upsertPlan(context, "Pro", {
    name: "Pro",
    cost: 999,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 1500,
    planFeatures: planFeaturesPro,
    bestSeller: true,
    stripePriceId: "price_1T97OjQB4ei9YzRVJqkhleiQ",
    stripeProductId: "prod_U7M6geL01RYWf5",
  });

  await upsertPlan(context, "Agencia", {
    name: "Agencia",
    cost: 1999,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 5000,
    planFeatures: planFeaturesAgency,
    stripePriceId: "price_1T98JSQB4ei9YzRV6wVlfDy5",
    stripeProductId: "prod_U7N3RIsVzkxTB1",
  });

  console.log("✅ SaasPlan seeding complete.");
  return freeId;
}
