import type { KeystoneContext } from "@keystone-6/core/types";
import { computeSalesVelocity } from "../../../../utils/analytics/salesVelocity";
import {
  adminPrisma,
  analyticsExcludedCompanyIds,
  assertPlatformAdmin,
  clampInt,
  toIso,
} from "./shared";

/**
 * Velocidad comercial de todas las empresas (o una, para el 360). El cálculo vive en
 * `utils/analytics/salesVelocity.ts` y es el mismo que ve cada cliente en su Analítica.
 */

const COMPANY_LIMIT = 25;

const typeDefs = `
  input AdminSalesVelocityInput {
    """Últimos N días (30–365, por defecto 90)."""
    days: Int
    """Solo esta empresa (ficha 360)."""
    companyId: ID
  }

  type AdminStageVelocity {
    stage: String!
    """Leads que entraron a la etapa en el periodo."""
    entered: Int!
    """De esos, cuántos pasaron a una etapa más adelante."""
    advanced: Int!
    """De esos, cuántos se perdieron (rechazada, perdido o descartado)."""
    lost: Int!
    """Mediana de días que se quedaron en la etapa (solo los que ya salieron)."""
    medianDays: Float
    """Siguen ahí hace 14 días o más sin moverse."""
    stalled: Int!
  }

  type AdminCompanyVelocity {
    companyId: ID!
    companyName: String!
    entered: Int!
    won: Int!
    lost: Int!
    winRate: Float
    medianCycleDays: Float
    medianFirstContactHours: Float
    stalled: Int!
  }

  type AdminSalesVelocity {
    days: Int!
    """Desde cuándo hay historial de etapas (antes no se guardaba)."""
    dataSince: String
    stages: [AdminStageVelocity!]!
    won: Int!
    lost: Int!
    """Ganados ÷ (ganados + perdidos) cerrados en el periodo (0–1)."""
    winRate: Float
    """Suma del valor estimado de los ganados."""
    wonValue: Float!
    """Mediana de días desde que el lead entró al pipeline hasta ganarse."""
    medianCycleDays: Float
    cycleSample: Int!
    """Leads que entraron al pipeline en el periodo."""
    newLeads: Int!
    """De esos, cuántos ya tuvieron contacto."""
    contacted: Int!
    contactedWithin2Days: Int!
    medianFirstContactHours: Float
    """Tratos abiertos (de Contactado a Negociación) sin moverse en 14 días o más."""
    stalled: Int!
    whatsappInbound: Int!
    whatsappAnswered: Int!
    whatsappAnsweredWithin1h: Int!
    """Mediana de minutos para contestar un WhatsApp de un lead."""
    whatsappMedianResponseMinutes: Float
    """Conversaciones donde la empresa escribió primero."""
    whatsappConversations: Int!
    """De esas, en cuántas contestó el lead (en 7 días)."""
    whatsappReplied: Int!
    companies: [AdminCompanyVelocity!]!
  }

  type Query {
    adminSalesVelocity(input: AdminSalesVelocityInput): AdminSalesVelocity!
  }
`;

const definition = `
  adminSalesVelocity(input: AdminSalesVelocityInput): AdminSalesVelocity!
`;

const resolver = {
  adminSalesVelocity: async (
    _root: unknown,
    { input }: { input?: { days?: number | null; companyId?: string | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 30, 365, 90);
    const companyId = input?.companyId?.trim() || null;
    const excluded = companyId ? [] : [...(await analyticsExcludedCompanyIds(prisma))];
    const velocity = await computeSalesVelocity(prisma, {
      days,
      companyWhere: companyId ?? { notIn: excluded },
    });

    let companies: Array<Record<string, unknown>> = [];
    if (!companyId && velocity.byCompany.size) {
      const names: Array<{ id: string; name: string }> = await prisma.saasCompany.findMany({
        where: { id: { in: [...velocity.byCompany.keys()] } },
        select: { id: true, name: true },
      });
      const nameById = new Map(names.map((company) => [company.id, company.name]));
      companies = [...velocity.byCompany.entries()]
        .filter(([id]) => nameById.has(id))
        .map(([id, stats]) => ({ companyId: id, companyName: nameById.get(id) ?? "Empresa", ...stats }))
        .sort((a, b) => Number(b.stalled) - Number(a.stalled) || Number(b.entered) - Number(a.entered))
        .slice(0, COMPANY_LIMIT);
    }

    const { byCompany: _byCompany, bySeller: _bySeller, stalledDeals: _stalled, dataSince, ...totals } = velocity;
    return { ...totals, dataSince: toIso(dataSince), companies };
  },
};

export default { typeDefs, definition, resolver };
