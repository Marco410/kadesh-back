import { KeystoneContext } from "@keystone-6/core/types";
import { PLAN_FREQUENCY } from "../../models/Saas/SaasPlan/constants";
import { getPlanFeatures } from "../../models/Saas/SaasPlan/getPlanFeatures";

type AppEnvironment = "dev" | "prod";

type StripePlanIds = {
  stripePriceId: string;
  stripeProductId: string;
};

type StripePlansByEnv = {
  starter: { monthly: StripePlanIds; annual: StripePlanIds };
  pro: { monthly: StripePlanIds; annual: StripePlanIds };
  agency: { monthly: StripePlanIds; annual: StripePlanIds };
};

const STRIPE_PLANS_BY_ENV: Record<AppEnvironment, StripePlansByEnv> = {
  dev: {
    starter: {
      monthly: {
        stripePriceId: "price_1TBQ0zQB4ei9YzRV6UzktPtz",
        stripeProductId: "prod_U7AkUsHqLHpNrL",
      },
      annual: {
        stripePriceId: "price_1TJJW4QB4ei9YzRVzb83K81Q",
        stripeProductId: "prod_U7AkUsHqLHpNrL",
      },
    },
    pro: {
      monthly: {
        stripePriceId: "price_1Tg6qqQB4ei9YzRVEyTCk3Er",
        stripeProductId: "prod_U7M6geL01RYWf5",
      },
      annual: {
        stripePriceId: "price_1Tg6rYQB4ei9YzRVQhPyTDTy",
        stripeProductId: "prod_U7M6geL01RYWf5",
      },
    },
    agency: {
      monthly: {
        stripePriceId: "price_1Tg6seQB4ei9YzRVsQUcU40a",
        stripeProductId: "prod_U7N3RIsVzkxTB1",
      },
      annual: {
        stripePriceId: "price_1Tg6tAQB4ei9YzRVBIY19yHz",
        stripeProductId: "prod_U7N3RIsVzkxTB1",
      },
    },
  },
  prod: {
    starter: {
      monthly: {
        stripePriceId: "price_1TBQ6LGPbYpK0LVQp2MriUB6",
        stripeProductId: "prod_U7AnyWRJzkmRoA",
      },
      annual: {
        stripePriceId: "price_1TJeq1GPbYpK0LVQQEonhacT",
        stripeProductId: "prod_U7AnyWRJzkmRoA",
      },
    },
    pro: {
      monthly: {
        stripePriceId: "price_1TBQ7bGPbYpK0LVQfZYui2GG",
        stripeProductId: "prod_U7RVylje9nXmgk",
      },
      annual: {
        stripePriceId: "price_1TJepaGPbYpK0LVQ6PPW6PQl",
        stripeProductId: "prod_U7RVylje9nXmgk",
      },
    },
    agency: {
      monthly: {
        stripePriceId: "price_1Tg6wMGPbYpK0LVQ4DEpYMqF",
        stripeProductId: "prod_U7RW0V6PcuSmkP",
      },
      annual: {
        stripePriceId: "price_1Tg6xMGPbYpK0LVQkbTO8L1I",
        stripeProductId: "prod_U7RW0V6PcuSmkP",
      },
    },
  },
};

function getAppEnvironment(): AppEnvironment {
  const env = process.env.ENVIROMENT?.trim().toLowerCase();
  return env === "prod" || env === "production" ? "prod" : "dev";
}

function getStripePlans(): StripePlansByEnv {
  return STRIPE_PLANS_BY_ENV[getAppEnvironment()];
}

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
    costOld?: number;
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
    ...(data.costOld != null && { costOld: data.costOld }),
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
  const stripePlans = getStripePlans();

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
    cost: 399,
    costOld: 799,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 150,
    ...stripePlans.starter.monthly,
    planFeatures: planFeaturesStarter,
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Starter Anual", {
    name: "Starter Anual",
    cost: 3990,
    costOld: 7990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 150,
    ...stripePlans.starter.annual,
    planFeatures: planFeaturesStarter,
    referralUpfrontCommissionPct: 15,
    referralRecurringCommissionPct: 0,
  });

  await upsertPlan(context, "Pro", {
    name: "Pro",
    cost: 799,
    costOld: 1699,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 500,
    planFeatures: planFeaturesPro,
    bestSeller: true,
    ...stripePlans.pro.monthly,
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Pro Anual", {
    name: "Pro Anual",
    cost: 7990,
    costOld: 16990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 500,
    planFeatures: planFeaturesPro,
    bestSeller: true,
    ...stripePlans.pro.annual,
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Agencia", {
    name: "Agencia",
    cost: 1999,
    costOld: 3499,
    frequency: PLAN_FREQUENCY.MONTHLY,
    leadLimit: 2000,
    planFeatures: planFeaturesAgency,
    ...stripePlans.agency.monthly,
    referralUpfrontCommissionPct: 20,
    referralRecurringCommissionPct: 10,
  });

  await upsertPlan(context, "Agencia Anual", {
    name: "Agencia Anual",
    cost: 19990,
    costOld: 34990,
    frequency: PLAN_FREQUENCY.ANNUAL,
    leadLimit: 2000,
    planFeatures: planFeaturesAgency,
    ...stripePlans.agency.annual,
    referralUpfrontCommissionPct: 15,
    referralRecurringCommissionPct: 0,
  });

  console.log(`✅ SaasPlans seeding complete (${getAppEnvironment()}).`);
  return freeId;
}
