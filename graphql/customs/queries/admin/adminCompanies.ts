import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import {
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  companyCredits,
  currentPeriod,
  insensitive,
  latestSubscriptionsByCompany,
  personRef,
  toIso,
  toYmd,
  trialEndDate,
} from "./shared";

/** Filtro por estado vigente; `none` = sin suscripción. */
const STATUS_NONE = "none";
const SORTS = ["recent", "name", "activity"] as const;
type Sort = (typeof SORTS)[number];

const typeDefs = `
  input AdminCompaniesInput {
    """Nombre de la empresa, correo de contacto o nombre/correo de cualquier integrante."""
    search: String
    """all | active | trialing | past_due | unpaid | cancelled | none (sin plan)"""
    status: String
    """recent (alta) | name | activity (último acceso del equipo)"""
    sort: String
    take: Int
    skip: Int
  }

  type AdminCompanyRow {
    id: ID!
    name: String!
    createdAt: String
    contactEmail: String
    isTest: Boolean!
    planName: String
    subscriptionId: ID
    subscriptionStatus: String
    activatedAt: String
    currentPeriodEnd: String
    trialEndsAt: String
    creditsPlan: Int!
    creditsBonus: Int!
    creditsUsed: Int!
    creditsRemaining: Int!
    usersCount: Int!
    leadsCount: Int!
    lastLoginAt: String
    owner: AdminPersonRef
  }

  type AdminCompaniesResult {
    items: [AdminCompanyRow!]!
    total: Int!
    """Conteo por estado vigente con la búsqueda aplicada (para los chips)."""
    statusCounts: [AdminCount!]!
  }

  type Query {
    adminCompanies(input: AdminCompaniesInput): AdminCompaniesResult!
  }
`;

const definition = `
  adminCompanies(input: AdminCompaniesInput): AdminCompaniesResult!
`;

type Input = {
  search?: string | null;
  status?: string | null;
  sort?: string | null;
  take?: number | null;
  skip?: number | null;
};

type CompanyRecord = {
  id: string;
  name: string;
  createdAt: Date | null;
  contactEmail: string | null;
  purchasedBonusCredits: number | null;
  plan: { name: string; leadLimit: number | null } | null;
  creditPeriods: Array<{
    planAllowance: number | null;
    bonusAllowance: number | null;
    used: number | null;
  }>;
  users: Array<{
    id: string;
    name: string;
    lastName: string;
    email: string;
    lastLoginAt: Date | null;
    userTest: boolean;
    roles: Array<{ name: string | null }>;
  }>;
  _count: { users: number; leads: number };
};

function searchWhere(search: string | null | undefined) {
  const q = search?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: insensitive(q) },
      { contactEmail: insensitive(q) },
      {
        users: {
          some: {
            OR: [
              { email: insensitive(q) },
              { name: insensitive(q) },
              { lastName: insensitive(q) },
            ],
          },
        },
      },
    ],
  };
}

function pickOwner(users: CompanyRecord["users"]) {
  const admin = users.find((u) =>
    u.roles.some((r) => r.name === Role.ADMIN_COMPANY),
  );
  return admin ?? users[0] ?? null;
}

const resolver = {
  adminCompanies: async (
    _root: unknown,
    { input }: { input?: Input | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);

    const take = clampInt(input?.take, 1, 100, 25);
    const skip = clampInt(input?.skip, 0, 1_000_000, 0);
    const status = input?.status?.trim() || "all";
    const sort: Sort = SORTS.includes(input?.sort as Sort)
      ? (input?.sort as Sort)
      : "recent";

    const baseWhere = searchWhere(input?.search);
    const matching: Array<{ id: string }> = await prisma.saasCompany.findMany({
      where: baseWhere,
      select: { id: true },
    });
    const matchingIds = matching.map((c) => c.id);
    const latest = await latestSubscriptionsByCompany(prisma, matchingIds);

    const counts = new Map<string, number>();
    for (const id of matchingIds) {
      const key = latest.get(id)?.status ?? STATUS_NONE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const statusCounts = [
      { key: "all", count: matchingIds.length },
      ...[...counts.entries()].map(([key, count]) => ({ key, count })),
    ];

    const filteredIds =
      status === "all"
        ? matchingIds
        : matchingIds.filter(
            (id) => (latest.get(id)?.status ?? STATUS_NONE) === status,
          );
    const total = filteredIds.length;

    let pageIds: string[];
    if (sort === "activity") {
      const lastLogins: Array<{ companyId: string | null; _max: { lastLoginAt: Date | null } }> =
        await prisma.user.groupBy({
          by: ["companyId"],
          where: { companyId: { in: filteredIds } },
          _max: { lastLoginAt: true },
        });
      const lastByCompany = new Map(
        lastLogins.map((row) => [row.companyId, row._max.lastLoginAt?.getTime() ?? 0]),
      );
      pageIds = [...filteredIds]
        .sort((a, b) => (lastByCompany.get(b) ?? 0) - (lastByCompany.get(a) ?? 0))
        .slice(skip, skip + take);
    } else {
      const ordered: Array<{ id: string }> = await prisma.saasCompany.findMany({
        where: { id: { in: filteredIds } },
        orderBy:
          sort === "name"
            ? [{ name: "asc" }]
            : [{ createdAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        skip,
        take,
        select: { id: true },
      });
      pageIds = ordered.map((c) => c.id);
    }

    const { year, month } = currentPeriod();
    const records: CompanyRecord[] = await prisma.saasCompany.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        contactEmail: true,
        purchasedBonusCredits: true,
        plan: { select: { name: true, leadLimit: true } },
        creditPeriods: {
          where: { year, month },
          take: 1,
          select: { planAllowance: true, bonusAllowance: true, used: true },
        },
        users: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            lastName: true,
            email: true,
            lastLoginAt: true,
            userTest: true,
            roles: { select: { name: true } },
          },
        },
        _count: { select: { users: true, leads: true } },
      },
    });
    const byId = new Map(records.map((r) => [r.id, r]));

    const items = pageIds
      .map((id) => byId.get(id))
      .filter((c): c is CompanyRecord => Boolean(c))
      .map((c) => {
        const sub = latest.get(c.id) ?? null;
        const credits = companyCredits({
          period: c.creditPeriods[0] ?? null,
          planLeadLimit: sub?.planLeadLimit ?? c.plan?.leadLimit ?? null,
          purchasedBonusCredits: c.purchasedBonusCredits,
        });
        const lastLogin = c.users.reduce<Date | null>(
          (max, u) => (u.lastLoginAt && (!max || u.lastLoginAt > max) ? u.lastLoginAt : max),
          null,
        );
        return {
          id: c.id,
          name: c.name,
          createdAt: toIso(c.createdAt),
          contactEmail: c.contactEmail,
          isTest: c.users.length > 0 && c.users.every((u) => u.userTest),
          planName: sub?.planName || c.plan?.name || null,
          subscriptionId: sub?.id ?? null,
          subscriptionStatus: sub?.status ?? null,
          activatedAt: toYmd(sub?.activatedAt),
          currentPeriodEnd: toYmd(sub?.currentPeriodEnd),
          trialEndsAt: toYmd(trialEndDate(sub)),
          creditsPlan: credits.plan,
          creditsBonus: credits.bonus,
          creditsUsed: credits.used,
          creditsRemaining: credits.remaining,
          usersCount: c._count.users,
          leadsCount: c._count.leads,
          lastLoginAt: toIso(lastLogin),
          owner: personRef(pickOwner(c.users)),
        };
      });

    return { items, total, statusCounts };
  },
};

export default { typeDefs, definition, resolver };
