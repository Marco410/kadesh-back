import type { KeystoneContext } from "@keystone-6/core/types";
import { loadCompanyMilestones, type CompanyMilestones } from "./milestones";
import {
  adminPrisma,
  analyticsExcludedCompanyIds,
  assertPlatformAdmin,
  clampInt,
  DAY_MS,
  daysAgo,
  toMxDay,
} from "./shared";

/**
 * Activación: de las empresas que se registraron en el periodo, cuántas llegaron a cada paso
 * y en cuántos días (mediana). Cada paso se cuenta por separado: hay quien paga sin cotizar.
 */

const typeDefs = `
  input AdminActivationInput {
    """Empresas registradas en los últimos N días (30–365, por defecto 90)."""
    days: Int
  }

  type AdminFunnelStep {
    """signup | profile | extraction | contact | quotation | paid"""
    key: String!
    label: String!
    companies: Int!
    """Porcentaje de las registradas (0–100)."""
    pct: Float!
    """Mediana de días desde el registro; null si el paso no guarda fecha o nadie llegó."""
    medianDays: Float
  }

  type AdminFunnelMonth {
    """Mes de registro (YYYY-MM, hora de CDMX)."""
    month: String!
    companies: Int!
    extraction: Int!
    contact: Int!
    quotation: Int!
    paid: Int!
  }

  type AdminActivationFunnel {
    from: String!
    to: String!
    cohortSize: Int!
    steps: [AdminFunnelStep!]!
    byMonth: [AdminFunnelMonth!]!
  }

  type Query {
    adminActivationFunnel(input: AdminActivationInput): AdminActivationFunnel!
  }
`;

const definition = `
  adminActivationFunnel(input: AdminActivationInput): AdminActivationFunnel!
`;

const STEPS: Array<{
  key: string;
  label: string;
  at?: (m: CompanyMilestones) => Date | null;
  reached?: (m: CompanyMilestones) => boolean;
}> = [
  { key: "profile", label: "Llenó su perfil de negocio", reached: (m) => m.profileDone },
  { key: "extraction", label: "Primera extracción", at: (m) => m.firstExtractionAt },
  { key: "contact", label: "Primer contacto con un lead", at: (m) => m.firstContactAt },
  { key: "quotation", label: "Primera cotización", at: (m) => m.firstQuotationAt },
  { key: "paid", label: "Pagó", at: (m) => m.paidAt },
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

const resolver = {
  adminActivationFunnel: async (
    _root: unknown,
    { input }: { input?: { days?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 30, 365, 90);
    const to = new Date();
    const from = daysAgo(days, to);

    const excludedIds = await analyticsExcludedCompanyIds(prisma);
    const companies: Array<{ id: string; createdAt: Date | null }> = (
      await prisma.saasCompany.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { id: true, createdAt: true },
      })
    ).filter((company: { id: string }) => !excludedIds.has(company.id));
    const milestones = await loadCompanyMilestones(
      prisma,
      companies.map((company) => company.id),
    );

    const steps = [
      {
        key: "signup",
        label: "Se registró",
        companies: companies.length,
        pct: companies.length ? 100 : 0,
        medianDays: 0,
      },
      ...STEPS.map((step) => {
        let reached = 0;
        const elapsed: number[] = [];
        for (const company of companies) {
          const m = milestones.get(company.id);
          if (!m) continue;
          if (step.reached) {
            if (step.reached(m)) reached += 1;
            continue;
          }
          const at = step.at?.(m);
          if (!at) continue;
          reached += 1;
          if (company.createdAt) {
            elapsed.push(Math.max(0, (at.getTime() - new Date(company.createdAt).getTime()) / DAY_MS));
          }
        }
        return {
          key: step.key,
          label: step.label,
          companies: reached,
          pct: pct(reached, companies.length),
          medianDays: step.reached ? null : median(elapsed),
        };
      }),
    ];

    const months = new Map<string, { month: string; companies: number; extraction: number; contact: number; quotation: number; paid: number }>();
    for (const company of companies) {
      if (!company.createdAt) continue;
      const month = toMxDay(company.createdAt).slice(0, 7);
      const row = months.get(month) ?? { month, companies: 0, extraction: 0, contact: 0, quotation: 0, paid: 0 };
      const m = milestones.get(company.id);
      row.companies += 1;
      if (m?.firstExtractionAt) row.extraction += 1;
      if (m?.firstContactAt) row.contact += 1;
      if (m?.firstQuotationAt) row.quotation += 1;
      if (m?.paidAt) row.paid += 1;
      months.set(month, row);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      cohortSize: companies.length,
      steps,
      byMonth: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    };
  },
};

export default { typeDefs, definition, resolver };
