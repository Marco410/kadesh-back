import type { KeystoneContext } from "@keystone-6/core/types";
import { adminPrisma, analyticsExcludedCompanyIds, assertPlatformAdmin, clampInt, toMxDay, unwrapPrisma } from "./shared";

/**
 * Retención por mes de registro: de las empresas que se dieron de alta en un mes, cuántas
 * siguieron usando Kadesh el mes siguiente, el otro, etc.
 *
 * "Usó Kadesh" en un mes = alguien del equipo tuvo el panel abierto, inició sesión, extrajo,
 * hizo algo en el CRM (eventos del panel, sin los del admin de Kadesh) o creó una cotización.
 * Todo en hora de CDMX.
 */

const typeDefs = `
  input AdminCohortsInput {
    """Meses de registro a mostrar, contando el actual (3–12, por defecto 6)."""
    months: Int
  }

  type AdminCohortRow {
    """Mes de registro (YYYY-MM)."""
    month: String!
    size: Int!
    """Empresas que usaron Kadesh en el mes de registro (posición 0), el siguiente (1)… hasta el mes actual."""
    active: [Int!]!
  }

  type AdminCohorts {
    rows: [AdminCohortRow!]!
  }

  type Query {
    adminCohorts(input: AdminCohortsInput): AdminCohorts!
  }
`;

const definition = `
  adminCohorts(input: AdminCohortsInput): AdminCohorts!
`;

function shiftMonth(month: string, offset: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const resolver = {
  adminCohorts: async (
    _root: unknown,
    { input }: { input?: { months?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const monthsBack = clampInt(input?.months, 3, 12, 6);
    const currentMonth = toMxDay(new Date()).slice(0, 7);
    const firstMonth = shiftMonth(currentMonth, -(monthsBack - 1));
    const start = new Date(`${firstMonth}-01T00:00:00.000-06:00`);
    // Las columnas de fecha guardan UTC sin zona: se compara contra el instante en UTC.
    const startUtc = start.toISOString().slice(0, 23).replace("T", " ");

    const excludedIds = await analyticsExcludedCompanyIds(prisma);
    const companies: Array<{ id: string; createdAt: Date | null }> = (
      await prisma.saasCompany.findMany({
        where: { createdAt: { gte: start } },
        select: { id: true, createdAt: true },
      })
    ).filter((company: { id: string }) => !excludedIds.has(company.id));
    if (!companies.length) return { rows: [] };

    const ids = companies.map((company) => company.id);
    const activity: Array<{ companyId: string; month: string }> = unwrapPrisma(await prisma.$queryRaw`
      WITH activity AS (
        SELECT "company" AS company_id, "day" AS d
          FROM "UserActivityDay"
          WHERE "company" = ANY(${ids}::text[]) AND "day" >= ${`${firstMonth}-01`}::date
        UNION ALL
        SELECT "company", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
          FROM "TechLeadSyncLog"
          WHERE "company" = ANY(${ids}::text[]) AND "createdAt" >= ${startUtc}::timestamp
        UNION ALL
        SELECT u."company", ((l."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
          FROM "UserAuthLog" l
          JOIN "User" u ON u."id" = l."user"
          WHERE l."success" AND u."company" = ANY(${ids}::text[]) AND l."createdAt" >= ${startUtc}::timestamp
        UNION ALL
        SELECT "company", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
          FROM "ActivityEvent"
          WHERE "company" = ANY(${ids}::text[]) AND "actor" IS NOT NULL AND "source" = 'web'
            AND "createdAt" >= ${startUtc}::timestamp
        UNION ALL
        SELECT "company", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
          FROM "SaasQuotation"
          WHERE "company" = ANY(${ids}::text[]) AND "createdAt" >= ${startUtc}::timestamp
      )
      SELECT company_id AS "companyId", to_char(d, 'YYYY-MM') AS "month"
      FROM activity
      GROUP BY 1, 2
    `);

    const activeMonths = new Map<string, Set<string>>();
    for (const row of activity) {
      const set = activeMonths.get(row.companyId) ?? new Set<string>();
      set.add(row.month);
      activeMonths.set(row.companyId, set);
    }

    const cohorts = new Map<string, string[]>();
    for (const company of companies) {
      if (!company.createdAt) continue;
      const month = toMxDay(company.createdAt).slice(0, 7);
      cohorts.set(month, [...(cohorts.get(month) ?? []), company.id]);
    }

    const rows = [];
    for (let offset = 0; offset < monthsBack; offset += 1) {
      const month = shiftMonth(firstMonth, offset);
      const members = cohorts.get(month) ?? [];
      const span = monthsBetween(month, currentMonth) + 1;
      const active = Array.from({ length: span }, (_, index) => {
        const target = shiftMonth(month, index);
        return members.filter((id) => activeMonths.get(id)?.has(target)).length;
      });
      rows.push({ month, size: members.length, active });
    }

    return { rows };
  },
};

export default { typeDefs, definition, resolver };
