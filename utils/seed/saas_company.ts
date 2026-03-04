import { KeystoneContext } from "@keystone-6/core/types";

export async function createSaasCompany(
  context: KeystoneContext,
  planId?: string | null,
): Promise<string | null> {
  const existing = await context.sudo().query.SaasCompany.findMany({
    query: "id",
  });
  if (existing.length > 0) {
    console.log("♻️  Skipped SaasCompany seeding.");
    return existing[0].id;
  }

  const company = await context.sudo().query.SaasCompany.createOne({
    data: {
      name: "Kadesh",
      allowedGooglePlaceCategories: ["dentistas", "gimnasios"],
      subscriptionStartedAt: new Date().toISOString().slice(0, 10),
      ...(planId && { plan: { connect: { id: planId } } }),
    },
    query: "id",
  });

  console.log("✅ SaasCompany seeding complete.");
  return company.id;
}
