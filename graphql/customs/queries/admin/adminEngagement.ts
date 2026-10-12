import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { mxToday, shiftDay } from "../../../../utils/usage/dailyUsageRollup";
import {
  adminPrisma,
  analyticsExcludedCompanyIds,
  assertPlatformAdmin,
  clampInt,
  latestSubscriptionsByCompany,
  optionalRead,
} from "./shared";

/**
 * Uso del producto: personas y empresas activas por día (latido del panel), DAU/WAU/MAU,
 * qué tanto vuelven (DAU ÷ MAU), qué módulos usa cada plan y qué secciones se abren más.
 * Sin cuentas de prueba ni el equipo de Kadesh. Los días terminan ayer (hoy va a medias).
 */

const MAU_DAYS = 30;
const WAU_DAYS = 7;

const MODULES: Array<{ key: string; field: string }> = [
  { key: "extraction", field: "extractions" },
  { key: "crm", field: "crmChanges" },
  { key: "activities", field: "activitiesLogged" },
  { key: "quotations", field: "quotationsCreated" },
  { key: "whatsapp", field: "whatsappSent" },
  { key: "ai", field: "aiCalls" },
];

const typeDefs = `
  input AdminEngagementInput {
    """Días de la serie diaria (14–90, por defecto 30)."""
    days: Int
  }

  type AdminDailyActive {
    day: String!
    users: Int!
    companies: Int!
  }

  type AdminModuleAdoption {
    """extraction | crm | activities | quotations | whatsapp | ai"""
    key: String!
    companies: Int!
  }

  type AdminPlanAdoption {
    planName: String!
    """Empresas activas o en prueba con este plan."""
    companies: Int!
    """Cuántas usaron cada módulo en los últimos 30 días."""
    modules: [AdminModuleAdoption!]!
  }

  type AdminSectionUsage {
    """Clave de sección del panel (la etiqueta la pone el front)."""
    key: String!
    views: Int!
    users: Int!
  }

  type AdminEngagement {
    """false mientras no haya latidos ni resumen diario."""
    ready: Boolean!
    through: String!
    series: [AdminDailyActive!]!
    """Promedio de personas activas por día en los últimos 30 días."""
    dau: Float!
    wau: Int!
    mau: Int!
    """DAU ÷ MAU (0–1): qué tan seguido vuelve quien usa Kadesh en el mes."""
    stickiness: Float!
    activeCompanies7d: Int!
    activeCompanies30d: Int!
    plans: [AdminPlanAdoption!]!
    sections: [AdminSectionUsage!]!
  }

  type Query {
    adminEngagement(input: AdminEngagementInput): AdminEngagement!
  }
`;

const definition = `
  adminEngagement(input: AdminEngagementInput): AdminEngagement!
`;

const dayDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

const resolver = {
  adminEngagement: async (
    _root: unknown,
    { input }: { input?: { days?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 14, 90, 30);
    const through = shiftDay(mxToday(), -1);
    const firstDay = shiftDay(through, -(Math.max(days, MAU_DAYS) - 1));
    const monthStartDay = shiftDay(through, -(MAU_DAYS - 1));
    const weekStartDay = shiftDay(through, -(WAU_DAYS - 1));

    const excludedIds = [...(await analyticsExcludedCompanyIds(prisma))];
    // Fuera: cuentas de prueba y el equipo de Kadesh (admins de plataforma).
    const excludedUsers: Array<{ id: string }> = await prisma.user.findMany({
      where: { OR: [{ userTest: true }, { roles: { some: { name: Role.ADMIN } } }] },
      select: { id: true },
    });
    const excludedUserIds = excludedUsers.map((user) => user.id);

    const activity: Array<{ day: Date; userId: string | null; companyId: string | null }> =
      prisma.userActivityDay
        ? await optionalRead(
            () =>
              prisma.userActivityDay.findMany({
                where: {
                  day: { gte: dayDate(firstDay), lte: dayDate(through) },
                  userId: { notIn: excludedUserIds },
                  OR: [{ companyId: null }, { companyId: { notIn: excludedIds } }],
                },
                select: { day: true, userId: true, companyId: true },
              }),
            [],
          )
        : [];

    const usersByDay = new Map<string, Set<string>>();
    const companiesByDay = new Map<string, Set<string>>();
    const weekUsers = new Set<string>();
    const monthUsers = new Set<string>();
    const weekCompanies = new Set<string>();
    const monthCompanies = new Set<string>();
    for (const row of activity) {
      if (!row.userId) continue;
      const day = new Date(row.day).toISOString().slice(0, 10);
      const users = usersByDay.get(day) ?? new Set<string>();
      users.add(row.userId);
      usersByDay.set(day, users);
      if (row.companyId) {
        const companies = companiesByDay.get(day) ?? new Set<string>();
        companies.add(row.companyId);
        companiesByDay.set(day, companies);
      }
      if (day >= monthStartDay) {
        monthUsers.add(row.userId);
        if (row.companyId) monthCompanies.add(row.companyId);
      }
      if (day >= weekStartDay) {
        weekUsers.add(row.userId);
        if (row.companyId) weekCompanies.add(row.companyId);
      }
    }

    const series = Array.from({ length: days }, (_, index) => {
      const day = shiftDay(through, -(days - 1 - index));
      return {
        day,
        users: usersByDay.get(day)?.size ?? 0,
        companies: companiesByDay.get(day)?.size ?? 0,
      };
    });
    let monthDaily = 0;
    for (let index = 0; index < MAU_DAYS; index += 1) {
      monthDaily += usersByDay.get(shiftDay(through, -index))?.size ?? 0;
    }
    const dau = Math.round((monthDaily / MAU_DAYS) * 10) / 10;
    const mau = monthUsers.size;

    // Módulos por plan (resumen diario de 30 días) de las empresas activas o en prueba.
    const usage: Array<{ companyId: string | null; _sum: Record<string, number | null> }> =
      prisma.saasCompanyDailyUsage
        ? await optionalRead(
            () =>
              prisma.saasCompanyDailyUsage.groupBy({
                by: ["companyId"],
                where: {
                  day: { gte: dayDate(monthStartDay), lte: dayDate(through) },
                  companyId: { notIn: excludedIds },
                },
                _sum: Object.fromEntries(
                  [...MODULES.map((module) => module.field), "extractionsFailed"].map((field) => [field, true]),
                ),
              }),
            [],
          )
        : [];
    const usageByCompany = new Map(usage.map((row) => [row.companyId, row._sum]));
    const latest = await latestSubscriptionsByCompany(prisma);
    const plans = new Map<string, { planName: string; companies: number; modules: Map<string, number> }>();
    for (const [companyId, sub] of latest) {
      if (excludedIds.includes(companyId)) continue;
      if (sub.status !== SUBSCRIPTION_STATUS.ACTIVE && sub.status !== SUBSCRIPTION_STATUS.TRIALING) continue;
      const planName = sub.planName || "Sin nombre";
      const plan = plans.get(planName) ?? { planName, companies: 0, modules: new Map<string, number>() };
      plan.companies += 1;
      const sums = usageByCompany.get(companyId);
      for (const module of MODULES) {
        let value = Number(sums?.[module.field] ?? 0);
        if (module.key === "extraction") value -= Number(sums?.extractionsFailed ?? 0);
        if (value > 0) plan.modules.set(module.key, (plan.modules.get(module.key) ?? 0) + 1);
      }
      plans.set(planName, plan);
    }

    const sectionsSince = `${monthStartDay} 06:00:00`;
    const sections: Array<{ key: string | null; views: number; users: number }> = await optionalRead(
      () => prisma.$queryRaw`
        SELECT "metadata"->>'section' AS "key", COUNT(*)::int AS "views", COUNT(DISTINCT "actor")::int AS "users"
        FROM "ActivityEvent"
        WHERE "type" = ${ACTIVITY_EVENT.UI_SECTION_VIEWED}
          AND "createdAt" >= ${sectionsSince}::timestamp
          AND "actor" IS NOT NULL
          AND NOT ("actor" = ANY(${excludedUserIds}::text[]))
          AND ("company" IS NULL OR NOT ("company" = ANY(${excludedIds}::text[])))
        GROUP BY 1
        ORDER BY 3 DESC, 2 DESC
        LIMIT 30
      `,
      [],
    );

    return {
      ready: activity.length > 0 || usage.length > 0,
      through,
      series,
      dau,
      wau: weekUsers.size,
      mau,
      stickiness: mau ? Math.round((dau / mau) * 1000) / 1000 : 0,
      activeCompanies7d: weekCompanies.size,
      activeCompanies30d: monthCompanies.size,
      plans: [...plans.values()]
        .sort((a, b) => b.companies - a.companies)
        .map((plan) => ({
          planName: plan.planName,
          companies: plan.companies,
          modules: MODULES.map((module) => ({ key: module.key, companies: plan.modules.get(module.key) ?? 0 })),
        })),
      sections: sections
        .filter((row) => row.key)
        .map((row) => ({ key: row.key as string, views: row.views, users: row.users })),
    };
  },
};

export default { typeDefs, definition, resolver };
