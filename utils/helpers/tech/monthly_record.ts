import { KeystoneContext } from "@keystone-6/core/types";

export async function getOrCreateMonthlyRecord(
    context: KeystoneContext,
    companyId: string,
    year: number,
    month: number,
  ): Promise<{ id: string; syncedCount: number }> {
    const [existing] = await context.sudo().query.SaasCompanyMonthlyLeadSync.findMany({
      where: {
        company: { id: { equals: companyId } },
        year: { equals: year },
        month: { equals: month },
      },
      take: 1,
      query: "id syncedCount",
    });
    if (existing) {
      return {
        id: existing.id,
        syncedCount: (existing as { syncedCount: number | null }).syncedCount ?? 0,
      };
    }
    const created = await context.sudo().query.SaasCompanyMonthlyLeadSync.createOne({
      data: {
        company: { connect: { id: companyId } },
        year,
        month,
        syncedCount: 0,
      },
      query: "id syncedCount",
    });
    return {
      id: created.id,
      syncedCount: (created as { syncedCount: number | null }).syncedCount ?? 0,
    };
  }