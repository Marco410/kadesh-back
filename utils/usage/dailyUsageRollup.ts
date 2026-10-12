import type { KeystoneContext } from "@keystone-6/core/types";
import { COMPANY_CREDIT_LEDGER_TYPE } from "../../models/Saas/SaasCompanyCreditLedger/constants";
import { ACTIVITY_CATEGORY, ACTIVITY_SOURCE } from "../../models/ActivityEvent/constants";

/**
 * Resumen diario de uso por empresa (`SaasCompanyDailyUsage`).
 *
 * Junta en una fila por empresa y día lo que ya vive en los logs (latido, accesos, extracciones,
 * créditos, IA, cambios del CRM, actividades, cotizaciones, WhatsApp). Así las tendencias de
 * 12 semanas y la comparación contra otras empresas del mismo plan salen de unas cuantas filas.
 *
 * El día es de CDMX (UTC-6 todo el año desde 2022). Recalcular un día es seguro: reemplaza sus
 * filas. Días sin actividad no tienen fila.
 */

const MX_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function mxToday(now: Date = new Date()): string {
  return MX_DAY.format(now);
}

export function shiftDay(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** [inicio, fin) del día en CDMX, en UTC. */
export function mxDayWindow(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00.000-06:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

type Metrics = {
  activeUsers: number;
  activeMinutes: number;
  logins: number;
  extractions: number;
  extractionsFailed: number;
  leadsCreated: number;
  leadsReused: number;
  creditsConsumed: number;
  aiCalls: number;
  crmChanges: number;
  activitiesLogged: number;
  quotationsCreated: number;
  quotationsSent: number;
  quotationsAccepted: number;
  whatsappSent: number;
  whatsappReceived: number;
};

const EMPTY: Metrics = {
  activeUsers: 0,
  activeMinutes: 0,
  logins: 0,
  extractions: 0,
  extractionsFailed: 0,
  leadsCreated: 0,
  leadsReused: 0,
  creditsConsumed: 0,
  aiCalls: 0,
  crmChanges: 0,
  activitiesLogged: 0,
  quotationsCreated: 0,
  quotationsSent: 0,
  quotationsAccepted: 0,
  whatsappSent: 0,
  whatsappReceived: 0,
};

export async function rollupCompanyDailyUsage(
  context: KeystoneContext,
  day: string,
): Promise<{ day: string; companies: number }> {
  if (!YMD_PATTERN.test(day)) throw new Error(`Día inválido: ${day}`);
  const prisma = context.sudo().prisma as any;
  const { start, end } = mxDayWindow(day);
  const window = { gte: start, lt: end };
  const dayDate = new Date(`${day}T00:00:00.000Z`);

  const byCompany = new Map<string, Metrics>();
  const bump = (companyId: string | null | undefined, key: keyof Metrics, value: number) => {
    if (!companyId || !value) return;
    const current = byCompany.get(companyId) ?? { ...EMPTY };
    current[key] += value;
    byCompany.set(companyId, current);
  };

  const [
    activityDays,
    logins,
    syncs,
    credits,
    aiCalls,
    crmEvents,
    salesActivities,
    quotationsCreated,
    quotationsSent,
    quotationsAccepted,
    whatsapp,
  ] = await Promise.all([
    prisma.userActivityDay.groupBy({
      by: ["companyId"],
      where: { day: dayDate, companyId: { not: null } },
      _count: { _all: true },
      _sum: { minutes: true },
    }),
    prisma.userAuthLog.groupBy({
      by: ["userId"],
      where: { createdAt: window, success: true, userId: { not: null } },
      _count: { _all: true },
    }),
    prisma.techLeadSyncLog.groupBy({
      by: ["companyId", "success"],
      where: { createdAt: window, companyId: { not: null } },
      _count: { _all: true },
      _sum: { created: true, alreadyInDb: true },
    }),
    prisma.saasCompanyCreditLedger.groupBy({
      by: ["companyId"],
      where: {
        createdAt: window,
        companyId: { not: null },
        type: {
          in: [COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC, COMPANY_CREDIT_LEDGER_TYPE.CONSUME_AI],
        },
      },
      _sum: { amount: true },
    }),
    prisma.techAiCallLog.groupBy({
      by: ["companyId"],
      where: { createdAt: window, companyId: { not: null } },
      _count: { _all: true },
    }),
    // Lo que hizo el equipo de la empresa; los cambios del admin de Kadesh no cuentan.
    prisma.activityEvent.groupBy({
      by: ["companyId"],
      where: {
        createdAt: window,
        companyId: { not: null },
        category: { in: [ACTIVITY_CATEGORY.CRM, ACTIVITY_CATEGORY.TEAM] },
        source: { not: ACTIVITY_SOURCE.ADMIN },
      },
      _count: { _all: true },
    }),
    prisma.techSalesActivity.findMany({
      where: { createdAt: window },
      select: {
        workspace: { select: { companyId: true } },
        createdBy: { select: { companyId: true } },
      },
    }),
    prisma.saasQuotation.groupBy({
      by: ["companyId"],
      where: { createdAt: window, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.saasQuotation.groupBy({
      by: ["companyId"],
      where: { sentAt: window, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.saasQuotation.groupBy({
      by: ["companyId"],
      where: { acceptedAt: window, companyId: { not: null } },
      _count: { _all: true },
    }),
    // Los importados traen la fecha del chat original: no son actividad de ese día.
    prisma.techWhatsAppMessage.groupBy({
      by: ["companyId", "direction"],
      where: {
        createdAt: window,
        companyId: { not: null },
        OR: [{ source: null }, { source: { not: "imported" } }],
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of activityDays as Array<{ companyId: string; _count: { _all: number }; _sum: { minutes: number | null } }>) {
    bump(row.companyId, "activeUsers", row._count._all);
    bump(row.companyId, "activeMinutes", row._sum.minutes ?? 0);
  }

  const loginRows = logins as Array<{ userId: string; _count: { _all: number } }>;
  if (loginRows.length) {
    const users: Array<{ id: string; companyId: string | null }> = await prisma.user.findMany({
      where: { id: { in: loginRows.map((row) => row.userId) } },
      select: { id: true, companyId: true },
    });
    const companyOf = new Map(users.map((user) => [user.id, user.companyId]));
    for (const row of loginRows) bump(companyOf.get(row.userId), "logins", row._count._all);
  }

  for (const row of syncs as Array<{ companyId: string; success: boolean; _count: { _all: number }; _sum: { created: number | null; alreadyInDb: number | null } }>) {
    bump(row.companyId, "extractions", row._count._all);
    if (!row.success) bump(row.companyId, "extractionsFailed", row._count._all);
    if (row.success) {
      bump(row.companyId, "leadsCreated", row._sum.created ?? 0);
      bump(row.companyId, "leadsReused", row._sum.alreadyInDb ?? 0);
    }
  }

  for (const row of credits as Array<{ companyId: string; _sum: { amount: number | null } }>) {
    bump(row.companyId, "creditsConsumed", Math.abs(row._sum.amount ?? 0));
  }
  for (const row of aiCalls as Array<{ companyId: string; _count: { _all: number } }>) {
    bump(row.companyId, "aiCalls", row._count._all);
  }
  for (const row of crmEvents as Array<{ companyId: string; _count: { _all: number } }>) {
    bump(row.companyId, "crmChanges", row._count._all);
  }
  for (const row of salesActivities as Array<{ workspace: { companyId: string | null } | null; createdBy: { companyId: string | null } | null }>) {
    bump(row.workspace?.companyId ?? row.createdBy?.companyId, "activitiesLogged", 1);
  }
  for (const row of quotationsCreated as Array<{ companyId: string; _count: { _all: number } }>) {
    bump(row.companyId, "quotationsCreated", row._count._all);
  }
  for (const row of quotationsSent as Array<{ companyId: string; _count: { _all: number } }>) {
    bump(row.companyId, "quotationsSent", row._count._all);
  }
  for (const row of quotationsAccepted as Array<{ companyId: string; _count: { _all: number } }>) {
    bump(row.companyId, "quotationsAccepted", row._count._all);
  }
  for (const row of whatsapp as Array<{ companyId: string; direction: string | null; _count: { _all: number } }>) {
    bump(row.companyId, row.direction === "inbound" ? "whatsappReceived" : "whatsappSent", row._count._all);
  }

  const computedAt = new Date();
  const companyIds = [...byCompany.keys()];
  // Solo empresas que existen (los logs pueden apuntar a una empresa ya borrada).
  const existing: Array<{ id: string }> = companyIds.length
    ? await prisma.saasCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true } })
    : [];
  const valid = new Set(existing.map((company) => company.id));

  for (const [companyId, metrics] of byCompany) {
    if (!valid.has(companyId)) continue;
    const key = `${companyId}:${day}`;
    await prisma.saasCompanyDailyUsage.upsert({
      where: { key },
      create: { key, companyId, day: dayDate, ...metrics, computedAt },
      update: { ...metrics, computedAt },
    });
  }
  // Si al recalcular una empresa ya no tiene actividad ese día, se quita su fila.
  await prisma.saasCompanyDailyUsage.deleteMany({
    where: { day: dayDate, companyId: { notIn: [...valid] } },
  });

  return { day, companies: valid.size };
}

/** Recalcula `days` días que terminan en `lastDay` (incluido). */
export async function rollupDailyUsageRange(
  context: KeystoneContext,
  lastDay: string,
  days: number,
): Promise<Array<{ day: string; companies: number }>> {
  const results: Array<{ day: string; companies: number }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    results.push(await rollupCompanyDailyUsage(context, shiftDay(lastDay, -offset)));
  }
  return results;
}
