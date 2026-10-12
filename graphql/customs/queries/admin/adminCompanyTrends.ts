import type { KeystoneContext } from "@keystone-6/core/types";
import { mxToday, shiftDay } from "../../../../utils/usage/dailyUsageRollup";
import {
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  latestSubscriptionsByCompany,
  optionalRead,
  testCompanyIds,
} from "./shared";

/**
 * Tendencia semanal de una empresa y comparación contra las demás empresas de su mismo plan.
 * Sale de `SaasCompanyDailyUsage` (resumen diario), no de los logs crudos.
 */

const typeDefs = `
  type AdminUsageWeek {
    """Primer día de la semana (YYYY-MM-DD); las semanas terminan ayer."""
    weekStart: String!
    activeDays: Int!
    activeMinutes: Int!
    logins: Int!
    extractions: Int!
    leadsCreated: Int!
    leadsReused: Int!
    creditsConsumed: Int!
    aiCalls: Int!
    crmChanges: Int!
    activitiesLogged: Int!
    quotationsCreated: Int!
    quotationsAccepted: Int!
    whatsappSent: Int!
  }

  type AdminBenchmarkMetric {
    key: String!
    """Total de esta empresa en las últimas 4 semanas."""
    company: Int!
    """Mediana de las empresas del mismo plan (incluye las que no hicieron nada)."""
    median: Int
  }

  type AdminCompanyTrends {
    """false si todavía no hay resumen diario (falta migrar o correr el cron)."""
    ready: Boolean!
    weeks: [AdminUsageWeek!]!
    planName: String
    """Empresas del mismo plan que entran en la comparación (sin cuentas de prueba)."""
    peers: Int!
    benchmark: [AdminBenchmarkMetric!]!
  }

  type Query {
    adminCompanyTrends(companyId: ID!, weeks: Int): AdminCompanyTrends!
  }
`;

const definition = `
  adminCompanyTrends(companyId: ID!, weeks: Int): AdminCompanyTrends!
`;

const WEEK_FIELDS = [
  "activeMinutes",
  "logins",
  "extractions",
  "leadsCreated",
  "leadsReused",
  "creditsConsumed",
  "aiCalls",
  "crmChanges",
  "activitiesLogged",
  "quotationsCreated",
  "quotationsAccepted",
  "whatsappSent",
] as const;
type WeekField = (typeof WEEK_FIELDS)[number];

/** Lo que se compara contra el plan. */
const BENCHMARK_FIELDS: WeekField[] = [
  "activeMinutes",
  "extractions",
  "crmChanges",
  "activitiesLogged",
  "quotationsCreated",
];

/** Con menos empresas la mediana no dice nada. */
const MIN_PEERS = 3;

type DayRow = { companyId: string; day: Date } & Record<WeekField, number | null>;

function median(values: number[]): number | null {
  if (values.length < MIN_PEERS) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const EMPTY = { ready: false, weeks: [], planName: null, peers: 0, benchmark: [] };

const resolver = {
  adminCompanyTrends: async (
    _root: unknown,
    { companyId, weeks }: { companyId: string; weeks?: number | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    if (!prisma.saasCompanyDailyUsage) return EMPTY;
    const weekCount = clampInt(weeks, 4, 26, 12);
    const lastDay = shiftDay(mxToday(), -1);
    const firstDay = shiftDay(lastDay, -(weekCount * 7 - 1));
    const benchmarkFrom = shiftDay(lastDay, -27);

    return optionalRead(async () => {
      const rows: DayRow[] = await prisma.saasCompanyDailyUsage.findMany({
        where: {
          companyId,
          day: { gte: new Date(`${firstDay}T00:00:00.000Z`), lte: new Date(`${lastDay}T00:00:00.000Z`) },
        },
        select: { companyId: true, day: true, ...Object.fromEntries(WEEK_FIELDS.map((f) => [f, true])) },
      });
      const anyRow = rows.length
        ? true
        : Boolean(await prisma.saasCompanyDailyUsage.findFirst({ select: { id: true } }));

      const series = Array.from({ length: weekCount }, (_, index) => {
        const weekStart = shiftDay(firstDay, index * 7);
        return {
          weekStart,
          activeDays: 0,
          ...Object.fromEntries(WEEK_FIELDS.map((field) => [field, 0])),
        } as { weekStart: string; activeDays: number } & Record<WeekField, number>;
      });
      for (const row of rows) {
        const day = new Date(row.day).toISOString().slice(0, 10);
        const index = Math.floor(
          (new Date(`${day}T00:00:00.000Z`).getTime() - new Date(`${firstDay}T00:00:00.000Z`).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        const week = series[index];
        if (!week) continue;
        if ((row.activeMinutes ?? 0) > 0) week.activeDays += 1;
        for (const field of WEEK_FIELDS) week[field] += row[field] ?? 0;
      }

      // Comparación: empresas cuya suscripción vigente tiene el mismo plan, sin cuentas de prueba.
      const latest = await latestSubscriptionsByCompany(prisma);
      const planName = latest.get(companyId)?.planName || null;
      const tests = await testCompanyIds(prisma);
      const peerIds = planName
        ? [...latest.entries()]
            .filter(([id, sub]) => sub.planName === planName && !tests.has(id))
            .map(([id]) => id)
        : [];

      const totals = new Map<string, Record<WeekField, number>>(
        peerIds.map((id) => [id, Object.fromEntries(WEEK_FIELDS.map((f) => [f, 0])) as Record<WeekField, number>]),
      );
      if (peerIds.length) {
        const peerRows = await prisma.saasCompanyDailyUsage.groupBy({
          by: ["companyId"],
          where: {
            companyId: { in: peerIds },
            day: { gte: new Date(`${benchmarkFrom}T00:00:00.000Z`), lte: new Date(`${lastDay}T00:00:00.000Z`) },
          },
          _sum: Object.fromEntries(BENCHMARK_FIELDS.map((f) => [f, true])),
        });
        for (const row of peerRows as Array<{ companyId: string; _sum: Record<WeekField, number | null> }>) {
          const total = totals.get(row.companyId);
          if (!total) continue;
          for (const field of BENCHMARK_FIELDS) total[field] = row._sum[field] ?? 0;
        }
      }

      const own = series.slice(-4).reduce(
        (acc, week) => {
          for (const field of BENCHMARK_FIELDS) acc[field] += week[field];
          return acc;
        },
        Object.fromEntries(BENCHMARK_FIELDS.map((f) => [f, 0])) as Record<string, number>,
      );
      // Sin contar a la propia empresa en su mediana.
      const others = [...totals.entries()].filter(([id]) => id !== companyId).map(([, total]) => total);

      return {
        ready: anyRow,
        weeks: series,
        planName,
        peers: others.length,
        benchmark: BENCHMARK_FIELDS.map((key) => ({
          key,
          company: own[key] ?? 0,
          median: median(others.map((total) => total[key])),
        })),
      };
    }, EMPTY);
  },
};

export default { typeDefs, definition, resolver };
