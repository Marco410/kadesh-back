import { KeystoneContext } from "@keystone-6/core/types";
import { PLAN_FREQUENCY } from "../../models/Saas/SaasPlan/constants";

export async function createSaasPlan(context: KeystoneContext): Promise<string | null> {
  const existing = await context.sudo().query.SaasPlan.findMany({
    query: "id",
  });
  if (existing.length > 0) {
    console.log("♻️  Skipped SaasPlan seeding.");
    return existing[0].id;
  }

  const starter = await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Freelance",
      cost: 499,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 200,
    },
    query: "id",
  });

  await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Pro",
      cost: 999,
      frequency: PLAN_FREQUENCY.MONTHLY,
      leadLimit: 1000,
    },
    query: "id",
  });

  await context.sudo().query.SaasPlan.createOne({
    data: {
      name: "Agencia",
      cost: 1999,
      frequency: PLAN_FREQUENCY.ANNUAL,
      leadLimit: 5000,
    },
    query: "id",
  });

  console.log("✅ SaasPlan seeding complete.");
  return starter.id;
}
