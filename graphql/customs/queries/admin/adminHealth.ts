import type { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { HEALTH_WINDOW_DAYS } from "../../../../utils/analytics/health";
import { loadCompanyHealth, type CompanyHealth } from "./healthData";
import {
  adminPrisma,
  analyticsExcludedCompanyIds,
  assertPlatformAdmin,
  clampInt,
  companySearchWhere,
  latestSubscriptionsByCompany,
  personRef,
  toIso,
} from "./shared";

/** Cuentas vivas: las que pagan, prueban o deben un pago. Canceladas y sin plan no se califican. */
const LIVE_STATUSES: string[] = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.UNPAID,
];
const SORTS = ["risk", "best", "drop", "name"] as const;
type Sort = (typeof SORTS)[number];

const typeDefs = `
  input AdminHealthInput {
    search: String
    """live (por defecto: activas, en prueba y con pago pendiente) | all | active | trialing | past_due | unpaid | cancelled | none"""
    status: String
    """healthy | watch | risk"""
    label: String
    """churn_risk | upsell"""
    flag: String
    accountManagerId: ID
    """risk (peor salud primero, por defecto) | best | drop (mayor caída de uso) | name"""
    sort: String
    """Solo esta empresa (ficha 360). Ignora los demás filtros."""
    companyId: ID
    take: Int
    skip: Int
  }

  """Puntos de cada parte de la salud (máximos: 30, 15, 25, 15, 15)."""
  type AdminHealthComponents {
    activity: Int!
    adoption: Int!
    usage: Int!
    engagement: Int!
    billing: Int!
  }

  type AdminHealthFlag {
    """churn_risk | upsell"""
    key: String!
    """payment_overdue | never_used | inactive | usage_drop | low_health | credits_exhausted | purchase_intent | trial_ready"""
    reason: String!
    label: String!
  }

  """Salud resumida para listas."""
  type AdminHealthBrief {
    score: Int!
    label: String!
    trend: String!
    changePct: Int
    flags: [AdminHealthFlag!]!
  }

  type AdminCompanyHealth {
    companyId: ID!
    companyName: String!
    planName: String
    subscriptionStatus: String
    """0–100"""
    score: Int!
    """healthy (70 o más) | watch (40–69) | risk (menos de 40)"""
    label: String!
    """up | down | stable | new (menos de 21 días) | inactive"""
    trend: String!
    """Actividad de las últimas 2 semanas contra las 2 anteriores (%)."""
    changePct: Int
    components: AdminHealthComponents!
    flags: [AdminHealthFlag!]!
    teamSize: Int!
    """Personas que entraron en las últimas 4 semanas."""
    activeUsers: Int!
    lastSeenAt: String
    accountManager: AdminPersonRef
  }

  type AdminHealthResult {
    """false mientras no haya resumen diario: la salud saldría en ceros."""
    ready: Boolean!
    """Último día con resumen (YYYY-MM-DD)."""
    computedThrough: String
    windowDays: Int!
    total: Int!
    """Con búsqueda y estado aplicados: healthy, watch, risk, churn_risk, upsell."""
    counts: [AdminCount!]!
    items: [AdminCompanyHealth!]!
  }

  type Query {
    adminHealth(input: AdminHealthInput): AdminHealthResult!
  }
`;

const definition = `
  adminHealth(input: AdminHealthInput): AdminHealthResult!
`;

type Input = {
  search?: string | null;
  status?: string | null;
  label?: string | null;
  flag?: string | null;
  accountManagerId?: string | null;
  sort?: string | null;
  companyId?: string | null;
  take?: number | null;
  skip?: number | null;
};

export function healthBrief(health: CompanyHealth | undefined | null) {
  if (!health) return null;
  return {
    score: health.score,
    label: health.label,
    trend: health.trend,
    changePct: health.changePct,
    flags: health.flags,
  };
}

function matchesStatus(status: string | null | undefined, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "live") return Boolean(status && LIVE_STATUSES.includes(status));
  if (filter === "none") return !status;
  return status === filter;
}

const resolver = {
  adminHealth: async (
    _root: unknown,
    { input }: { input?: Input | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const take = clampInt(input?.take, 1, 100, 25);
    const skip = clampInt(input?.skip, 0, 1_000_000, 0);
    const sort: Sort = SORTS.includes(input?.sort as Sort) ? (input?.sort as Sort) : "risk";
    const statusFilter = input?.status?.trim() || "live";
    const companyId = input?.companyId?.trim() || null;

    let scopedIds: string[];
    if (companyId) {
      scopedIds = [companyId];
    } else {
      const managerId = input?.accountManagerId?.trim();
      const search = companySearchWhere(input?.search);
      const matching: Array<{ id: string }> = await prisma.saasCompany.findMany({
        where: managerId ? { AND: [search, { accountManagerId: managerId }] } : search,
        select: { id: true },
      });
      const excludedIds = await analyticsExcludedCompanyIds(prisma);
      scopedIds = matching.map((c) => c.id).filter((id) => !excludedIds.has(id));
    }

    const latest = await latestSubscriptionsByCompany(prisma, scopedIds);
    if (!companyId) {
      scopedIds = scopedIds.filter((id) => matchesStatus(latest.get(id)?.status, statusFilter));
    }
    const { ready, computedThrough, byCompany } = await loadCompanyHealth(prisma, scopedIds);
    const scored = scopedIds
      .map((id) => byCompany.get(id))
      .filter((health): health is CompanyHealth => Boolean(health));

    const counts = new Map<string, number>([
      ["healthy", 0],
      ["watch", 0],
      ["risk", 0],
      ["churn_risk", 0],
      ["upsell", 0],
    ]);
    for (const health of scored) {
      counts.set(health.label, (counts.get(health.label) ?? 0) + 1);
      for (const key of new Set(health.flags.map((flag) => flag.key))) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const label = input?.label?.trim();
    const flag = input?.flag?.trim();
    const filtered = scored.filter(
      (health) =>
        (!label || health.label === label) &&
        (!flag || health.flags.some((item) => item.key === flag)),
    );

    const companies: Array<{
      id: string;
      name: string;
      accountManager: { id: string; name: string; lastName: string | null; email: string | null } | null;
    }> = await prisma.saasCompany.findMany({
      where: { id: { in: filtered.map((health) => health.companyId) } },
      select: {
        id: true,
        name: true,
        accountManager: { select: { id: true, name: true, lastName: true, email: true } },
      },
    });
    const companyById = new Map(companies.map((company) => [company.id, company]));
    const seen = (health: CompanyHealth) => health.lastSeenAt?.getTime() ?? 0;

    const ordered = [...filtered].sort((a, b) => {
      switch (sort) {
        case "best":
          return b.score - a.score || seen(b) - seen(a);
        case "drop":
          return (a.changePct ?? Infinity) - (b.changePct ?? Infinity) || a.score - b.score;
        case "name":
          return (companyById.get(a.companyId)?.name ?? "").localeCompare(
            companyById.get(b.companyId)?.name ?? "",
            "es",
          );
        default:
          return a.score - b.score || seen(a) - seen(b);
      }
    });

    const items = ordered.slice(skip, skip + take).map((health) => {
      const company = companyById.get(health.companyId);
      const sub = latest.get(health.companyId);
      return {
        companyId: health.companyId,
        companyName: company?.name ?? "Empresa",
        planName: sub?.planName || null,
        subscriptionStatus: sub?.status ?? null,
        score: health.score,
        label: health.label,
        trend: health.trend,
        changePct: health.changePct,
        components: health.components,
        flags: health.flags,
        teamSize: health.teamSize,
        activeUsers: health.activeUsers,
        lastSeenAt: toIso(health.lastSeenAt),
        accountManager: personRef(company?.accountManager),
      };
    });

    return {
      ready,
      computedThrough,
      windowDays: HEALTH_WINDOW_DAYS,
      total: filtered.length,
      counts: [...counts.entries()].map(([key, count]) => ({ key, count })),
      items,
    };
  },
};

export default { typeDefs, definition, resolver };
