import type { KeystoneContext } from "@keystone-6/core/types";
import { attributionChannel, type SignupAttribution } from "../../../../utils/analytics/attribution";
import { loadCompanyMilestones } from "./milestones";
import { adminPrisma, analyticsExcludedCompanyIds, assertPlatformAdmin, clampInt, daysAgo } from "./shared";

/**
 * De dónde llegan las empresas y cuáles terminan usando y pagando. La atribución es la de quien
 * creó la cuenta (primer contacto que guardó el front al registrarse). Si entró con código de
 * referido, el canal es "Referido" aunque traiga UTM.
 */

const LIST_LIMIT = 10;
const REFERRAL = "Referido";

const typeDefs = `
  input AdminAcquisitionInput {
    """Empresas registradas en los últimos N días (7–365, por defecto 90)."""
    days: Int
  }

  type AdminAcquisitionRow {
    key: String!
    companies: Int!
    """Hicieron al menos una extracción."""
    activated: Int!
    paid: Int!
  }

  type AdminAcquisition {
    days: Int!
    companies: Int!
    """Empresas con atribución guardada (las anteriores a esta medición salen como "Sin dato")."""
    withData: Int!
    """utm_source, dominio que refirió, Directo, Referido o Sin dato."""
    channels: [AdminAcquisitionRow!]!
    """Página por la que entraron (sin query)."""
    landings: [AdminAcquisitionRow!]!
    """utm_campaign"""
    campaigns: [AdminAcquisitionRow!]!
  }

  type Query {
    adminAcquisition(input: AdminAcquisitionInput): AdminAcquisition!
  }
`;

const definition = `
  adminAcquisition(input: AdminAcquisitionInput): AdminAcquisition!
`;

type Row = { key: string; companies: number; activated: number; paid: number };

function bump(map: Map<string, Row>, key: string, activated: boolean, paid: boolean) {
  const row = map.get(key) ?? { key, companies: 0, activated: 0, paid: 0 };
  row.companies += 1;
  if (activated) row.activated += 1;
  if (paid) row.paid += 1;
  map.set(key, row);
}

const sortRows = (map: Map<string, Row>, limit?: number) => {
  const rows = [...map.values()].sort((a, b) => b.companies - a.companies || b.paid - a.paid);
  return limit ? rows.slice(0, limit) : rows;
};

const resolver = {
  adminAcquisition: async (
    _root: unknown,
    { input }: { input?: { days?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 7, 365, 90);
    const excludedIds = await analyticsExcludedCompanyIds(prisma);

    const companies: Array<{ id: string }> = (
      await prisma.saasCompany.findMany({
        where: { createdAt: { gte: daysAgo(days) } },
        select: { id: true },
      })
    ).filter((company: { id: string }) => !excludedIds.has(company.id));
    const ids = companies.map((company) => company.id);

    // Quien creó la cuenta es la primera persona de la empresa; los invitados no traen atribución.
    const users: Array<{
      companyId: string | null;
      signupAttribution: SignupAttribution | null;
      referredById: string | null;
    }> = ids.length
      ? await prisma.user.findMany({
          where: { companyId: { in: ids } },
          orderBy: [{ createdAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
          select: { companyId: true, signupAttribution: true, referredById: true },
        })
      : [];
    const founder = new Map<string, (typeof users)[number]>();
    for (const user of users) {
      if (user.companyId && !founder.has(user.companyId)) founder.set(user.companyId, user);
    }

    const milestones = await loadCompanyMilestones(prisma, ids);
    const channels = new Map<string, Row>();
    const landings = new Map<string, Row>();
    const campaigns = new Map<string, Row>();
    let withData = 0;

    for (const companyId of ids) {
      const user = founder.get(companyId);
      const attribution = user?.signupAttribution ?? null;
      const m = milestones.get(companyId);
      const activated = Boolean(m?.firstExtractionAt);
      const paid = Boolean(m?.paidAt);
      if (attribution || user?.referredById) withData += 1;

      const channel = user?.referredById ? REFERRAL : attributionChannel(attribution);
      bump(channels, channel, activated, paid);
      if (attribution?.landingPath) bump(landings, attribution.landingPath, activated, paid);
      if (attribution?.utm_campaign) bump(campaigns, attribution.utm_campaign, activated, paid);
    }

    return {
      days,
      companies: ids.length,
      withData,
      channels: sortRows(channels),
      landings: sortRows(landings, LIST_LIMIT),
      campaigns: sortRows(campaigns, LIST_LIMIT),
    };
  },
};

export default { typeDefs, definition, resolver };
