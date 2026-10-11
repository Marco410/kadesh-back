import type { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { PLAN_FREQUENCY } from "../../../../models/Saas/SaasPlan/constants";
import { TRIAL_DAYS_FREE_PLAN } from "../../../../utils/constants/constants";
import { getCurrentPeriodParts } from "../../../../utils/saas/companyCredits";

/** Tipos GraphQL compartidos por las queries de Operaciones (se registran una sola vez). */
export const adminSharedTypeDefs = `
  type AdminCount {
    key: String!
    count: Int!
  }

  type AdminAmountCount {
    key: String!
    count: Int!
    amount: Float!
  }

  type AdminPersonRef {
    id: ID!
    name: String!
    lastName: String
    email: String
  }

  type AdminCompanyRef {
    id: ID!
    name: String!
  }
`;

export const ADMIN_ONLY_MESSAGE =
  "Solo un administrador de Kadesh puede ver esta información.";

export function assertPlatformAdmin(context: KeystoneContext): void {
  if (!isPlatformAdmin(context.session)) {
    throw new Error(ADMIN_ONLY_MESSAGE);
  }
}

/** Prisma sin control de acceso. Llamar solo después de `assertPlatformAdmin`. */
export function adminPrisma(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * DAY_MS);
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Campos `@postgresql.Date` (activatedAt, currentPeriodEnd…): se devuelven como `YYYY-MM-DD`, igual que Keystone. */
export function toYmd(value: Date | string | null | undefined): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

const MX_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario en hora de CDMX (`YYYY-MM-DD`), para agrupar series por día. */
export function toMxDay(value: Date | string): string {
  return MX_DAY.format(value instanceof Date ? value : new Date(value));
}

export function clampInt(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function insensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function personRef(
  user:
    | { id: string; name?: string | null; lastName?: string | null; email?: string | null }
    | null
    | undefined,
) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? "",
    lastName: user.lastName ?? null,
    email: user.email ?? null,
  };
}

export const PERSON_SELECT = {
  id: true,
  name: true,
  lastName: true,
  email: true,
} as const;

export type LatestSubscription = {
  id: string;
  companyId: string;
  status: string | null;
  planName: string;
  planCost: number | null;
  planCurrency: string;
  planFrequency: string;
  planLeadLimit: number | null;
  activatedAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  createdAt: Date | null;
};

/**
 * Suscripción vigente = la más reciente de cada empresa. Hay una fila por contrato y las
 * viejas no siempre quedan canceladas, así que filtrar con `subscriptions.some` mezclaría
 * contratos anteriores.
 */
export async function latestSubscriptionsByCompany(
  prisma: any,
  companyIds?: string[],
): Promise<Map<string, LatestSubscription>> {
  const rows: LatestSubscription[] = await prisma.saasCompanySubscription.findMany({
    where: { companyId: companyIds ? { in: companyIds } : { not: null } },
    orderBy: [
      { companyId: "asc" },
      { createdAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ],
    distinct: ["companyId"],
    select: {
      id: true,
      companyId: true,
      status: true,
      planName: true,
      planCost: true,
      planCurrency: true,
      planFrequency: true,
      planLeadLimit: true,
      activatedAt: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      createdAt: true,
    },
  });
  return new Map(rows.map((row) => [row.companyId, row]));
}

/** Fin de la prueba: `currentPeriodEnd` o `activatedAt` + días de prueba del plan gratis. */
export function trialEndDate(sub: LatestSubscription | null | undefined): Date | null {
  if (!sub || sub.status !== SUBSCRIPTION_STATUS.TRIALING) return null;
  if (sub.currentPeriodEnd) return new Date(sub.currentPeriodEnd);
  if (!sub.activatedAt) return null;
  return new Date(new Date(sub.activatedAt).getTime() + TRIAL_DAYS_FREE_PLAN * DAY_MS);
}

/** Monto mensual equivalente de un plan (para MRR). Pago único y gratis no cuentan. */
export function monthlyAmount(
  cost: number | null | undefined,
  frequency: string | null | undefined,
): number {
  if (!cost || cost <= 0) return 0;
  switch (frequency) {
    case PLAN_FREQUENCY.MONTHLY:
      return cost;
    case PLAN_FREQUENCY.ANNUAL:
      return cost / 12;
    case PLAN_FREQUENCY.WEEKLY:
      return (cost * 52) / 12;
    default:
      return 0;
  }
}

/** Empresas cuyos usuarios son todos `userTest`: se excluyen de KPIs y MRR. */
export async function testCompanyIds(prisma: any): Promise<Set<string>> {
  const rows: Array<{ id: string }> = await prisma.saasCompany.findMany({
    where: {
      users: { some: { userTest: true }, none: { userTest: false } },
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

export type CompanyCredits = {
  plan: number;
  bonus: number;
  used: number;
  remaining: number;
};

/** Mismo cálculo que el panel del cliente: cupo del plan + extra − gastado en el mes. */
export function companyCredits(params: {
  period?: { planAllowance: number | null; bonusAllowance: number | null; used: number | null } | null;
  planLeadLimit?: number | null;
  purchasedBonusCredits?: number | null;
}): CompanyCredits {
  const plan = params.period?.planAllowance ?? params.planLeadLimit ?? 0;
  const bonus = params.period?.bonusAllowance ?? params.purchasedBonusCredits ?? 0;
  const used = params.period?.used ?? 0;
  return { plan, bonus, used, remaining: Math.max(0, plan + bonus - used) };
}

export function currentPeriod() {
  return getCurrentPeriodParts();
}

/**
 * Items CRM (actividad, seguimiento, tarea, propuesta) de una empresa.
 * Los leads se comparten entre empresas, así que el lead solo no basta: cuenta el workspace,
 * o —si no tiene workspace— la empresa de quien lo creó o lo tiene asignado.
 */
export function crmCompanyScope(
  companyId: string,
  assigneeField: "assignedSeller" | "responsible" = "assignedSeller",
) {
  return {
    OR: [
      { workspace: { companyId } },
      {
        AND: [
          { workspaceId: null },
          {
            OR: [
              { createdBy: { companyId } },
              { [assigneeField]: { companyId } },
            ],
          },
        ],
      },
    ],
  };
}

export function countsToList(
  rows: Array<{ key: string | null | undefined; count: number }>,
): Array<{ key: string; count: number }> {
  return rows
    .map((row) => ({ key: row.key ?? "", count: row.count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Tablas de la Fase 2 (`UserActivityDay`, `ActivityEvent`). Antes de correr `yarn migrate`
 * el cliente de Prisma no las tiene o la tabla no existe: estas lecturas devuelven vacío
 * y Operaciones sigue funcionando con `lastLoginAt` y los logs de siempre.
 */
async function optional<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

/** Última vez que alguien del equipo tuvo el panel abierto (latido), por empresa. */
export async function lastSeenByCompany(
  prisma: any,
  companyIds: string[],
): Promise<Map<string, Date>> {
  if (!prisma.userActivityDay || !companyIds.length) return new Map();
  return optional(async () => {
    const rows: Array<{ companyId: string | null; _max: { lastSeenAt: Date | null } }> =
      await prisma.userActivityDay.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _max: { lastSeenAt: true },
      });
    return new Map(
      rows
        .filter((row) => row.companyId && row._max.lastSeenAt)
        .map((row) => [row.companyId as string, row._max.lastSeenAt as Date]),
    );
  }, new Map());
}

/** Personas con el panel abierto desde `since` (latido). */
export async function activeUserIdsSince(prisma: any, since: Date): Promise<string[]> {
  if (!prisma.userActivityDay) return [];
  return optional(async () => {
    const rows: Array<{ userId: string | null }> = await prisma.userActivityDay.findMany({
      where: { lastSeenAt: { gte: since } },
      distinct: ["userId"],
      select: { userId: true },
    });
    return rows.map((row) => row.userId).filter((id): id is string => Boolean(id));
  }, []);
}

export function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  return dates.reduce<Date | null>(
    (max, date) => (date && (!max || date > max) ? date : max),
    null,
  );
}

export { optional as optionalRead };
