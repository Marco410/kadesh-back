import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { TRIAL_DAYS_FREE_PLAN } from "../../../../utils/constants/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";

/**
 * Acciones de Operaciones sobre una empresa que no tocan el acceso de las personas:
 * extender la prueba gratuita y asignar el dueño de cuenta de Kadesh. Solo admin de plataforma.
 */

const typeDefs = `
  type AdminOpsActionResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    adminExtendTrial(companyId: ID!, days: Int, until: String): AdminOpsActionResult!
    adminSetCompanyAccountManager(companyId: ID!, userId: ID): AdminOpsActionResult!
  }
`;

const definition = `
  adminExtendTrial(companyId: ID!, days: Int, until: String): AdminOpsActionResult!
  adminSetCompanyAccountManager(companyId: ID!, userId: ID): AdminOpsActionResult!
`;

const MAX_EXTENSION_DAYS = 90;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MX_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function result(success: boolean, message: string) {
  return { success, message };
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ymdOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function personName(user: { name?: string | null; lastName?: string | null; email?: string | null } | null) {
  if (!user) return null;
  return [user.name, user.lastName].filter(Boolean).join(" ") || user.email || null;
}

/** Estados en los que una prueba vencida vuelve a quedar en prueba al extenderla. */
const REVIVABLE_STATUSES: ReadonlySet<string> = new Set([
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.UNPAID,
  SUBSCRIPTION_STATUS.CANCELLED,
]);

const resolver = {
  /**
   * Mueve el fin de la prueba gratuita (`currentPeriodEnd` de la suscripción vigente).
   * `days` suma desde hoy o desde el fin actual (lo que sea más tarde); `until` fija la fecha.
   * Si la prueba ya había vencido, la suscripción vuelve a "en prueba".
   */
  adminExtendTrial: async (
    _root: unknown,
    { companyId, days, until }: { companyId: string; days?: number | null; until?: string | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session as any)) {
      return result(false, "Solo un administrador de Kadesh puede extender pruebas.");
    }
    const prisma = context.sudo().prisma as any;
    const sub = await prisma.saasCompanySubscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        planName: true,
        planCost: true,
        activatedAt: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    });
    if (!sub) return result(false, "La empresa no tiene suscripción.");
    if ((sub.planCost ?? 0) > 0 || sub.stripeSubscriptionId) {
      return result(false, "La empresa tiene un plan de pago: la prueba solo aplica al plan gratuito.");
    }

    const today = MX_DAY.format(new Date());
    const activated = ymdOf(sub.activatedAt);
    const currentEnd =
      ymdOf(sub.currentPeriodEnd) ?? (activated ? addDays(activated, TRIAL_DAYS_FREE_PLAN) : today);

    let newEnd: string;
    if (until) {
      if (!YMD.test(until)) return result(false, "La fecha debe tener el formato AAAA-MM-DD.");
      if (until <= today) return result(false, "La nueva fecha tiene que ser posterior a hoy.");
      if (until > addDays(today, MAX_EXTENSION_DAYS * 2)) {
        return result(false, "Esa fecha está demasiado lejos; usa un plan si van a ser meses.");
      }
      newEnd = until;
    } else {
      const extra = Math.floor(Number(days));
      if (!Number.isFinite(extra) || extra < 1 || extra > MAX_EXTENSION_DAYS) {
        return result(false, `Indica entre 1 y ${MAX_EXTENSION_DAYS} días.`);
      }
      newEnd = addDays(currentEnd > today ? currentEnd : today, extra);
    }

    const revive = REVIVABLE_STATUSES.has(sub.status ?? "");
    await context.sudo().query.SaasCompanySubscription.updateOne({
      where: { id: sub.id },
      data: {
        currentPeriodEnd: newEnd,
        ...(revive ? { status: SUBSCRIPTION_STATUS.TRIALING } : {}),
      },
    });

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_TRIAL_EXTENDED,
      companyId,
      entityType: "SaasCompanySubscription",
      entityId: sub.id,
      summary: `Extendió la prueba hasta el ${newEnd}${revive ? " (estaba vencida)" : ""}`,
      metadata: { from: currentEnd, to: newEnd, reactivated: revive, previousStatus: sub.status },
    });

    return result(
      true,
      revive ? `Prueba reactivada hasta el ${newEnd}.` : `Prueba extendida hasta el ${newEnd}.`,
    );
  },

  /** Persona de Kadesh responsable de la cuenta. `userId: null` la quita. */
  adminSetCompanyAccountManager: async (
    _root: unknown,
    { companyId, userId }: { companyId: string; userId?: string | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session as any)) {
      return result(false, "Solo un administrador de Kadesh puede asignar cuentas.");
    }
    const prisma = context.sudo().prisma as any;
    const company = await prisma.saasCompany.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        accountManager: { select: { id: true, name: true, lastName: true, email: true } },
      },
    });
    if (!company) return result(false, "No se encontró la empresa.");

    let manager: { id: string; name: string | null; lastName: string | null; email: string | null } | null = null;
    if (userId) {
      manager = await prisma.user.findFirst({
        where: { id: userId, roles: { some: { name: Role.ADMIN } } },
        select: { id: true, name: true, lastName: true, email: true },
      });
      if (!manager) return result(false, "Esa persona no es del equipo de Kadesh.");
    }
    if ((company.accountManager?.id ?? null) === (manager?.id ?? null)) {
      return result(true, "Sin cambios.");
    }

    await prisma.saasCompany.update({
      where: { id: companyId },
      data: { accountManagerId: manager?.id ?? null },
    });

    const from = personName(company.accountManager);
    const to = personName(manager);
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_ACCOUNT_MANAGER_ASSIGNED,
      companyId,
      entityType: "SaasCompany",
      entityId: companyId,
      summary: to
        ? `Asignó la cuenta ${company.name} a ${to}${manager?.id === getSessionUserId(context.session as any) ? " (a sí mismo)" : ""}`
        : `Quitó el dueño de cuenta de ${company.name}`,
      metadata: { from, to, fromUserId: company.accountManager?.id ?? null, toUserId: manager?.id ?? null },
    });

    return result(true, to ? `Ahora la cuenta es de ${to}.` : "La cuenta quedó sin dueño.");
  },
};

export default { typeDefs, definition, resolver };
