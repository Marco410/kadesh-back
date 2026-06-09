import { KeystoneContext } from "@keystone-6/core/types";
import { PLAN_FREQUENCY } from "../../models/Saas/SaasPlan/constants";

type AppEnvironment = "dev" | "prod";

type StripeCreditIds = {
  stripePriceId: string;
  stripeProductId: string;
};

type StripeCreditPackagesByEnv = {
  basic: StripeCreditIds;
  growth: StripeCreditIds;
  scale: StripeCreditIds;
};

const STRIPE_CREDIT_PACKAGES_BY_ENV: Record<
  AppEnvironment,
  StripeCreditPackagesByEnv
> = {
  dev: {
    basic: {
      stripePriceId: "price_1TgAL4QB4ei9YzRVvDbxiaut",
      stripeProductId: "prod_UfVLJujUzBJdRH",
    },
    growth: {
      stripePriceId: "price_1TgALJQB4ei9YzRVKCdglcL7",
      stripeProductId: "prod_UfVLJujUzBJdRH",
    },
    scale: {
      stripePriceId: "price_1TgALSQB4ei9YzRVnlwLKrf4",
      stripeProductId: "prod_UfVLJujUzBJdRH",
    },
  },
  prod: {
    basic: {
      stripePriceId: "price_1TgAMOGPbYpK0LVQe3TMj6dV",
      stripeProductId: "prod_UfVNp0CBMO7eUa",
    },
    growth: {
      stripePriceId: "price_1TgAMZGPbYpK0LVQomSQhxjm",
      stripeProductId: "prod_UfVNp0CBMO7eUa",
    },
    scale: {
      stripePriceId: "price_1TgAMiGPbYpK0LVQvKkLQGFR",
      stripeProductId: "prod_UfVNp0CBMO7eUa",
    },
  },
};

function getAppEnvironment(): AppEnvironment {
  const env = process.env.ENVIROMENT?.trim().toLowerCase();
  return env === "prod" || env === "production" ? "prod" : "dev";
}

function getStripeCreditPackages(): StripeCreditPackagesByEnv {
  return STRIPE_CREDIT_PACKAGES_BY_ENV[getAppEnvironment()];
}

async function upsertCreditPackage(
  context: KeystoneContext,
  slug: string,
  data: {
    name: string;
    cost: number;
    costOld?: number;
    frequency: string;
    creditsToAdd: number;
    stripePriceId?: string;
    stripeProductId?: string;
    bestSeller?: boolean;
  },
): Promise<string> {
  const [existing] = await context.sudo().query.SaasCredit.findMany({
    where: { slug: { equals: slug } },
    query: "id",
    take: 1,
  });
  const payload = {
    slug,
    name: data.name,
    cost: data.cost,
    ...(data.costOld != null && { costOld: data.costOld }),
    frequency: data.frequency,
    creditsToAdd: data.creditsToAdd,
    ...(data.stripePriceId != null && { stripePriceId: data.stripePriceId }),
    ...(data.stripeProductId != null && {
      stripeProductId: data.stripeProductId,
    }),
    ...(data.bestSeller != null && { bestSeller: data.bestSeller }),
  };
  if (existing) {
    await context.sudo().query.SaasCredit.updateOne({
      where: { id: (existing as { id: string }).id },
      data: payload,
    });
    return (existing as { id: string }).id;
  }
  const created = await context.sudo().query.SaasCredit.createOne({
    data: payload,
    query: "id",
  });
  return (created as { id: string }).id;
}

export async function createSaasCreditPackages(
  context: KeystoneContext,
): Promise<void> {
  const stripeCreditPackages = getStripeCreditPackages();

  await upsertCreditPackage(context, "Recarga Básica", {
    name: "250 Créditos Extra",
    cost: 349,
    costOld: 699,
    frequency: PLAN_FREQUENCY.ONCE,
    creditsToAdd: 250,
    ...stripeCreditPackages.basic,
    bestSeller: false,
  });

  await upsertCreditPackage(context, "Recarga Crecimiento", {
    name: "1,000 Créditos Extra",
    cost: 999,
    costOld: 1396,
    frequency: PLAN_FREQUENCY.ONCE,
    creditsToAdd: 1000,
    ...stripeCreditPackages.growth,
    bestSeller: true,
  });

  await upsertCreditPackage(context, "Recarga Escala", {
    name: "3,000 Créditos Extra",
    cost: 2499,
    costOld: 4188,
    frequency: PLAN_FREQUENCY.ONCE,
    creditsToAdd: 3000,
    ...stripeCreditPackages.scale,
    bestSeller: false,
  });

  console.log(`✅ SaasCredit packages seeding complete (${getAppEnvironment()}).`);
}
