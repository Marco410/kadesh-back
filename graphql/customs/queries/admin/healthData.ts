import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import {
  HEALTH_WINDOW_DAYS,
  activityPoints,
  scoreHealth,
  type HealthResult,
} from "../../../../utils/analytics/health";
import { mxToday, shiftDay } from "../../../../utils/usage/dailyUsageRollup";
import { DAY_MS, latestSubscriptionsByCompany, optionalRead } from "./shared";

/**
 * Junta lo que necesita `scoreHealth` para muchas empresas a la vez, con pocas consultas:
 * resumen diario (4 semanas que terminan ayer), latido por persona, tamaño del equipo,
 * plan vigente, créditos agotados este mes, señales de compra y pagos fallidos.
 */

export type CompanyHealth = HealthResult & {
  companyId: string;
  teamSize: number;
  activeUsers: number;
  lastSeenAt: Date | null;
};

export type HealthData = {
  /** Hay resumen diario (si no, la salud sale en ceros y no sirve para decidir). */
  ready: boolean;
  /** Último día con resumen (`YYYY-MM-DD`). */
  computedThrough: string | null;
  byCompany: Map<string, CompanyHealth>;
};

type UsageRow = {
  companyId: string;
  day: Date;
  activeMinutes: number | null;
  logins: number | null;
  extractions: number | null;
  extractionsFailed: number | null;
  crmChanges: number | null;
  activitiesLogged: number | null;
  quotationsCreated: number | null;
  whatsappSent: number | null;
};

const dayDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

function bump<K>(map: Map<K, number>, key: K | null | undefined, value = 1) {
  if (key == null) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

export async function loadCompanyHealth(
  prisma: any,
  companyIds?: string[],
): Promise<HealthData> {
  const empty: HealthData = { ready: false, computedThrough: null, byCompany: new Map() };
  if (!prisma.saasCompanyDailyUsage) return empty;

  return optionalRead(async () => {
    const today = mxToday();
    const lastDay = shiftDay(today, -1);
    const firstDay = shiftDay(lastDay, -(HEALTH_WINDOW_DAYS - 1));
    const midDay = shiftDay(lastDay, -13);
    const windowStart = new Date(`${firstDay}T00:00:00-06:00`);
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-06:00`);
    const byIds = companyIds ? { in: companyIds } : undefined;

    const [
      companies,
      usageRows,
      activePairs,
      teams,
      latest,
      exhausted,
      intent,
      failedPayments,
      seen,
      logins,
      latestRollup,
    ] = await Promise.all([
      prisma.saasCompany.findMany({
        where: byIds ? { id: byIds } : {},
        select: { id: true, createdAt: true },
      }),
      prisma.saasCompanyDailyUsage.findMany({
        where: {
          day: { gte: dayDate(firstDay), lte: dayDate(lastDay) },
          ...(byIds ? { companyId: byIds } : {}),
        },
        select: {
          companyId: true,
          day: true,
          activeMinutes: true,
          logins: true,
          extractions: true,
          extractionsFailed: true,
          crmChanges: true,
          activitiesLogged: true,
          quotationsCreated: true,
          whatsappSent: true,
        },
      }),
      prisma.userActivityDay.groupBy({
        by: ["companyId", "userId"],
        where: {
          day: { gte: dayDate(firstDay), lte: dayDate(lastDay) },
          companyId: byIds ?? { not: null },
        },
      }),
      prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: byIds ?? { not: null }, anonymizedAt: null },
        _count: { _all: true },
      }),
      latestSubscriptionsByCompany(prisma, companyIds),
      prisma.activityEvent.findMany({
        where: {
          type: ACTIVITY_EVENT.CREDITS_EXHAUSTED,
          createdAt: { gte: monthStart },
          ...(byIds ? { companyId: byIds } : {}),
        },
        select: { companyId: true, createdAt: true },
      }),
      prisma.activityEvent.groupBy({
        by: ["companyId"],
        where: {
          type: { in: [ACTIVITY_EVENT.UI_UPGRADE_CLICKED, ACTIVITY_EVENT.UI_FEATURE_LOCKED_VIEWED] },
          createdAt: { gte: windowStart },
          companyId: byIds ?? { not: null },
        },
        _count: { _all: true },
      }),
      prisma.saasPayment.findMany({
        where: { status: "failed", createdAt: { gte: windowStart } },
        select: {
          subscription: { select: { companyId: true } },
          user: { select: { companyId: true } },
        },
      }),
      prisma.userActivityDay.groupBy({
        by: ["companyId"],
        where: { companyId: byIds ?? { not: null } },
        _max: { lastSeenAt: true },
      }),
      prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: byIds ?? { not: null } },
        _max: { lastLoginAt: true },
      }),
      prisma.saasCompanyDailyUsage.findFirst({ orderBy: { day: "desc" }, select: { day: true } }),
    ]);

    // Agregados por empresa.
    type Totals = {
      activeDays: number;
      minutes: number;
      extractions: number;
      extractionsFailed: number;
      crmChanges: number;
      activities: number;
      quotations: number;
      whatsappSent: number;
      recent: number;
      previous: number;
    };
    const totals = new Map<string, Totals>();
    const midDate = dayDate(midDay).getTime();
    for (const row of usageRows as UsageRow[]) {
      const t =
        totals.get(row.companyId) ??
        { activeDays: 0, minutes: 0, extractions: 0, extractionsFailed: 0, crmChanges: 0, activities: 0, quotations: 0, whatsappSent: 0, recent: 0, previous: 0 };
      const day = {
        minutes: row.activeMinutes ?? 0,
        extractions: Math.max(0, (row.extractions ?? 0) - (row.extractionsFailed ?? 0)),
        crmChanges: row.crmChanges ?? 0,
        activities: row.activitiesLogged ?? 0,
        quotations: row.quotationsCreated ?? 0,
      };
      // Día activo: alguien tuvo el panel abierto, inició sesión o hizo algo del negocio.
      const didSomething =
        day.minutes > 0 ||
        (row.logins ?? 0) > 0 ||
        (row.extractions ?? 0) > 0 ||
        day.crmChanges + day.activities + day.quotations + (row.whatsappSent ?? 0) > 0;
      if (didSomething) t.activeDays += 1;
      t.minutes += day.minutes;
      t.extractions += row.extractions ?? 0;
      t.extractionsFailed += row.extractionsFailed ?? 0;
      t.crmChanges += day.crmChanges;
      t.activities += day.activities;
      t.quotations += day.quotations;
      t.whatsappSent += row.whatsappSent ?? 0;
      const points = activityPoints(day);
      if (new Date(row.day).getTime() >= midDate) t.recent += points;
      else t.previous += points;
      totals.set(row.companyId, t);
    }

    const activeUsers = new Map<string, number>();
    for (const pair of activePairs as Array<{ companyId: string | null }>) bump(activeUsers, pair.companyId);
    const teamSize = new Map<string, number>(
      (teams as Array<{ companyId: string | null; _count: { _all: number } }>)
        .filter((row) => row.companyId)
        .map((row) => [row.companyId as string, row._count._all]),
    );
    const exhaustedDay = new Map<string, number>();
    for (const row of exhausted as Array<{ companyId: string | null; createdAt: Date }>) {
      if (!row.companyId) continue;
      const day = Number(mxToday(new Date(row.createdAt)).slice(8, 10));
      exhaustedDay.set(row.companyId, Math.min(exhaustedDay.get(row.companyId) ?? 99, day));
    }
    const intentCount = new Map<string, number>(
      (intent as Array<{ companyId: string | null; _count: { _all: number } }>)
        .filter((row) => row.companyId)
        .map((row) => [row.companyId as string, row._count._all]),
    );
    const failures = new Map<string, number>();
    for (const row of failedPayments as Array<{ subscription: { companyId: string | null } | null; user: { companyId: string | null } | null }>) {
      bump(failures, row.subscription?.companyId ?? row.user?.companyId);
    }
    const lastSeen = new Map<string, Date>();
    for (const row of seen as Array<{ companyId: string | null; _max: { lastSeenAt: Date | null } }>) {
      if (row.companyId && row._max.lastSeenAt) lastSeen.set(row.companyId, row._max.lastSeenAt);
    }
    for (const row of logins as Array<{ companyId: string | null; _max: { lastLoginAt: Date | null } }>) {
      if (!row.companyId || !row._max.lastLoginAt) continue;
      const current = lastSeen.get(row.companyId);
      if (!current || row._max.lastLoginAt > current) lastSeen.set(row.companyId, row._max.lastLoginAt);
    }

    const now = Date.now();
    const byCompany = new Map<string, CompanyHealth>();
    for (const company of companies as Array<{ id: string; createdAt: Date | null }>) {
      const t = totals.get(company.id);
      const seenAt = lastSeen.get(company.id) ?? null;
      const ageDays = company.createdAt
        ? Math.max(0, Math.floor((now - new Date(company.createdAt).getTime()) / DAY_MS))
        : HEALTH_WINDOW_DAYS;
      const result = scoreHealth({
        ageDays,
        teamSize: teamSize.get(company.id) ?? 0,
        activeUsers: activeUsers.get(company.id) ?? 0,
        activeDays: t?.activeDays ?? 0,
        minutes: t?.minutes ?? 0,
        extractions: t?.extractions ?? 0,
        extractionsFailed: t?.extractionsFailed ?? 0,
        crmChanges: t?.crmChanges ?? 0,
        activities: t?.activities ?? 0,
        quotations: t?.quotations ?? 0,
        whatsappSent: t?.whatsappSent ?? 0,
        recentActivity: t?.recent ?? 0,
        previousActivity: t?.previous ?? 0,
        status: latest.get(company.id)?.status ?? null,
        creditsExhaustedDay: exhaustedDay.get(company.id) ?? null,
        purchaseIntent: intentCount.get(company.id) ?? 0,
        paymentFailures: failures.get(company.id) ?? 0,
        daysSinceSeen: seenAt ? Math.floor((now - new Date(seenAt).getTime()) / DAY_MS) : null,
      });
      byCompany.set(company.id, {
        ...result,
        companyId: company.id,
        teamSize: teamSize.get(company.id) ?? 0,
        activeUsers: activeUsers.get(company.id) ?? 0,
        lastSeenAt: seenAt,
      });
    }

    const computedThrough = latestRollup?.day ? new Date(latestRollup.day).toISOString().slice(0, 10) : null;
    return { ready: Boolean(computedThrough), computedThrough, byCompany };
  }, empty);
}
