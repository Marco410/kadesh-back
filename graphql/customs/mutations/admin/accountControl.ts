import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import { ACTIVITY_EVENT, ACTIVITY_SOURCE } from "../../../../models/ActivityEvent/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { IMPERSONATION_TTL_MS, getImpersonation } from "../../../../auth/impersonation";
import { assertPlatformAdmin } from "../../queries/admin/shared";
import { anonymizeUserData } from "../../../../utils/account/anonymizeUser";

/**
 * Control de cuentas desde Operaciones (fase 3): suspender, cerrar sesiones, transferir la
 * propiedad, "entrar como" (solo lectura), y derechos ARCO (exportar y anonimizar).
 *
 * Todo es solo para admin de plataforma, escribe con Prisma (sin hooks: nada de correos ni
 * efectos secundarios) y queda en Actividad. Las sesiones se invalidan subiendo
 * `User.sessionVersion`; el guardián (`auth/sessionGuards.ts`) descarta los tokens viejos.
 * Nunca se puede actuar sobre uno mismo ni sobre otra persona del equipo de Kadesh.
 */

const typeDefs = `
  type AdminControlResult {
    success: Boolean!
    message: String!
  }

  type AdminImpersonationResult {
    success: Boolean!
    message: String!
    """Token de sesión de la persona, solo lectura. Lo guarda el front en lugar del token del admin."""
    token: String
    expiresAt: String
    user: AdminPersonRef
    companyName: String
  }

  type Mutation {
    adminSetCompanySuspension(companyId: ID!, suspended: Boolean!, reason: String): AdminControlResult!
    adminSetUserSuspension(userId: ID!, suspended: Boolean!, reason: String): AdminControlResult!
    adminRevokeSessions(userId: ID, companyId: ID): AdminControlResult!
    adminTransferCompanyOwnership(companyId: ID!, newOwnerId: ID!, removeOtherAdmins: Boolean): AdminControlResult!
    adminStartImpersonation(userId: ID!, reason: String!): AdminImpersonationResult!
    endImpersonation: AdminControlResult!
    adminExportPersonData(userId: ID!): JSON!
    adminAnonymizeUser(userId: ID!, confirmEmail: String!, reason: String!): AdminControlResult!
  }
`;

const definition = `
  adminSetCompanySuspension(companyId: ID!, suspended: Boolean!, reason: String): AdminControlResult!
  adminSetUserSuspension(userId: ID!, suspended: Boolean!, reason: String): AdminControlResult!
  adminRevokeSessions(userId: ID, companyId: ID): AdminControlResult!
  adminTransferCompanyOwnership(companyId: ID!, newOwnerId: ID!, removeOtherAdmins: Boolean): AdminControlResult!
  adminStartImpersonation(userId: ID!, reason: String!): AdminImpersonationResult!
  endImpersonation: AdminControlResult!
  adminExportPersonData(userId: ID!): JSON!
  adminAnonymizeUser(userId: ID!, confirmEmail: String!, reason: String!): AdminControlResult!
`;

const MIN_REASON = 5;
const MAX_REASON = 500;
/** Roles "de empresa": si alguien se queda sin ninguno al quitarle admin, se le deja user_company. */
const COMPANY_ROLE_NAMES: readonly string[] = [
  Role.ADMIN_COMPANY,
  Role.GERENCIA,
  Role.VENDEDOR,
  Role.USER_COMPANY,
];

type RoleRef = { id?: string; name: string };
type PersonRow = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string | null;
  suspendedAt?: Date | null;
  anonymizedAt?: Date | null;
  roles: RoleRef[];
};

function result(success: boolean, message: string) {
  return { success, message };
}

function prismaOf(context: KeystoneContext): any {
  return context.sudo().prisma;
}

function hasPlatformRole(roles: RoleRef[] | null | undefined) {
  return (roles ?? []).some((role) => role.name === Role.ADMIN);
}

function fullName(person: { name?: string | null; lastName?: string | null; email?: string | null } | null) {
  if (!person) return "una persona";
  return [person.name, person.lastName].filter(Boolean).join(" ").trim() || person.email || "una persona";
}

function cleanReason(reason: string | null | undefined): string | null {
  const text = reason?.trim() ?? "";
  return text.length >= MIN_REASON ? text.slice(0, MAX_REASON) : null;
}

function maskTail(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, "");
  return digits.length <= 4 ? "****" : `****${digits.slice(-4)}`;
}

/** Valida que quien llama sea admin de plataforma y devuelve su id. */
function adminIdOf(context: KeystoneContext): string | null {
  const session = context.session as any;
  return isPlatformAdmin(session) ? getSessionUserId(session) : null;
}

const NOT_ADMIN = result(false, "Solo un administrador de Kadesh puede hacer esto.");
const REASON_REQUIRED = result(false, `Escribe el motivo (mínimo ${MIN_REASON} letras).`);

const resolver = {
  /** Nadie del equipo puede entrar mientras la empresa esté suspendida; al suspender se cierran sus sesiones. */
  adminSetCompanySuspension: async (
    _root: unknown,
    { companyId, suspended, reason }: { companyId: string; suspended: boolean; reason?: string | null },
    context: KeystoneContext,
  ) => {
    if (!adminIdOf(context)) return NOT_ADMIN;
    const prisma = prismaOf(context);
    const company = await prisma.saasCompany.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        suspendedAt: true,
        suspendedReason: true,
        users: { select: { id: true, roles: { select: { name: true } } } },
      },
    });
    if (!company) return result(false, "No se encontró la empresa.");

    if (suspended) {
      const why = cleanReason(reason);
      if (!why) return REASON_REQUIRED;
      if (company.suspendedAt) return result(false, "La empresa ya está suspendida.");
      if (company.users.some((user: PersonRow) => hasPlatformRole(user.roles))) {
        return result(false, "En esta empresa hay personas del equipo de Kadesh: no se puede suspender.");
      }
      await prisma.saasCompany.update({
        where: { id: companyId },
        data: { suspendedAt: new Date(), suspendedReason: why },
      });
      const { count } = await prisma.user.updateMany({
        where: { companyId },
        data: { sessionVersion: { increment: 1 } },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_COMPANY_SUSPENDED,
        companyId,
        entityType: "SaasCompany",
        entityId: companyId,
        summary: `Suspendió el acceso de ${company.name}`,
        metadata: { reason: why, sessionsClosedFor: count },
      });
      return result(true, `${company.name} quedó suspendida. Se cerraron las sesiones de ${count} persona${count === 1 ? "" : "s"}.`);
    }

    if (!company.suspendedAt) return result(false, "La empresa no está suspendida.");
    await prisma.saasCompany.update({
      where: { id: companyId },
      data: { suspendedAt: null, suspendedReason: null },
    });
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_COMPANY_REACTIVATED,
      companyId,
      entityType: "SaasCompany",
      entityId: companyId,
      summary: `Reactivó el acceso de ${company.name}`,
      metadata: { previousReason: company.suspendedReason ?? null },
    });
    return result(true, `${company.name} puede volver a entrar.`);
  },

  /** La persona no puede entrar mientras esté suspendida; al suspender se cierran sus sesiones. */
  adminSetUserSuspension: async (
    _root: unknown,
    { userId, suspended, reason }: { userId: string; suspended: boolean; reason?: string | null },
    context: KeystoneContext,
  ) => {
    const adminId = adminIdOf(context);
    if (!adminId) return NOT_ADMIN;
    if (userId === adminId) return result(false, "No puedes suspenderte a ti mismo.");
    const prisma = prismaOf(context);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        companyId: true,
        suspendedAt: true,
        suspendedReason: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
      },
    });
    if (!user) return result(false, "No se encontró a la persona.");
    if (hasPlatformRole(user.roles)) return result(false, "No se puede suspender a alguien del equipo de Kadesh.");
    if (user.anonymizedAt) return result(false, "La cuenta está anonimizada.");
    const name = fullName(user);

    if (suspended) {
      const why = cleanReason(reason);
      if (!why) return REASON_REQUIRED;
      if (user.suspendedAt) return result(false, "La persona ya está suspendida.");
      await prisma.user.update({
        where: { id: userId },
        data: { suspendedAt: new Date(), suspendedReason: why, sessionVersion: { increment: 1 } },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_USER_SUSPENDED,
        companyId: user.companyId ?? null,
        entityType: "User",
        entityId: userId,
        summary: `Suspendió el acceso de ${name}`,
        metadata: { reason: why },
      });
      return result(true, `${name} ya no puede entrar. Se cerraron sus sesiones.`);
    }

    if (!user.suspendedAt) return result(false, "La persona no está suspendida.");
    await prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null, suspendedReason: null },
    });
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_USER_REACTIVATED,
      companyId: user.companyId ?? null,
      entityType: "User",
      entityId: userId,
      summary: `Reactivó el acceso de ${name}`,
      metadata: { previousReason: user.suspendedReason ?? null },
    });
    return result(true, `${name} puede volver a entrar.`);
  },

  /** Cierra las sesiones abiertas de una persona o de todo un equipo (tendrán que volver a iniciar sesión). */
  adminRevokeSessions: async (
    _root: unknown,
    { userId, companyId }: { userId?: string | null; companyId?: string | null },
    context: KeystoneContext,
  ) => {
    const adminId = adminIdOf(context);
    if (!adminId) return NOT_ADMIN;
    if (Boolean(userId) === Boolean(companyId)) {
      return result(false, "Indica una persona o una empresa.");
    }
    const prisma = prismaOf(context);

    if (userId) {
      if (userId === adminId) return result(false, "Para cerrar tus propias sesiones usa Cerrar sesión.");
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, lastName: true, email: true, companyId: true },
      });
      if (!user) return result(false, "No se encontró a la persona.");
      await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
      void logActivity(context, {
        type: ACTIVITY_EVENT.ADMIN_SESSIONS_REVOKED,
        companyId: user.companyId ?? null,
        entityType: "User",
        entityId: userId,
        summary: `Cerró las sesiones de ${fullName(user)}`,
        metadata: { users: 1 },
      });
      return result(true, `Se cerraron las sesiones de ${fullName(user)}.`);
    }

    const company = await prisma.saasCompany.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) return result(false, "No se encontró la empresa.");
    // Quien hace el cambio no se saca a sí mismo aunque sea de esa empresa.
    const { count } = await prisma.user.updateMany({
      where: { companyId, id: { not: adminId } },
      data: { sessionVersion: { increment: 1 } },
    });
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_SESSIONS_REVOKED,
      companyId: company.id,
      entityType: "SaasCompany",
      entityId: company.id,
      summary: `Cerró las sesiones del equipo de ${company.name}`,
      metadata: { users: count },
    });
    return result(true, `Se cerraron las sesiones de ${count} persona${count === 1 ? "" : "s"} de ${company.name}.`);
  },

  /**
   * Hace administrador de la empresa a otra persona del equipo. Opcionalmente quita ese rol a
   * los demás (sin tocar al equipo de Kadesh); quien se queda sin rol de empresa queda como usuario.
   * La facturación no cambia: la tarjeta y el cliente de Stripe siguen siendo de quien pagó.
   */
  adminTransferCompanyOwnership: async (
    _root: unknown,
    {
      companyId,
      newOwnerId,
      removeOtherAdmins,
    }: { companyId: string; newOwnerId: string; removeOtherAdmins?: boolean | null },
    context: KeystoneContext,
  ) => {
    if (!adminIdOf(context)) return NOT_ADMIN;
    const prisma = prismaOf(context);
    const company = await prisma.saasCompany.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        users: {
          select: {
            id: true,
            name: true,
            lastName: true,
            email: true,
            suspendedAt: true,
            anonymizedAt: true,
            roles: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!company) return result(false, "No se encontró la empresa.");
    const target: PersonRow | undefined = company.users.find((user: PersonRow) => user.id === newOwnerId);
    if (!target) return result(false, "Esa persona no es de esta empresa.");
    if (target.suspendedAt || target.anonymizedAt) {
      return result(false, "Esa persona está suspendida o anonimizada.");
    }

    const roles: Array<{ id: string; name: string }> = await prisma.role.findMany({
      where: { name: { in: [Role.ADMIN_COMPANY, Role.USER_COMPANY] } },
      select: { id: true, name: true },
    });
    const adminCompanyRole = roles.find((role) => role.name === Role.ADMIN_COMPANY);
    const userCompanyRole = roles.find((role) => role.name === Role.USER_COMPANY);
    if (!adminCompanyRole) return result(false, "No existe el rol de administrador de empresa.");

    if (!target.roles.some((role) => role.name === Role.ADMIN_COMPANY)) {
      await prisma.user.update({
        where: { id: target.id },
        data: { roles: { connect: { id: adminCompanyRole.id } } },
      });
    }

    const removed: string[] = [];
    if (removeOtherAdmins) {
      for (const user of company.users as PersonRow[]) {
        if (user.id === target.id || hasPlatformRole(user.roles)) continue;
        if (!user.roles.some((role) => role.name === Role.ADMIN_COMPANY)) continue;
        const keepsCompanyRole = user.roles.some(
          (role) => role.name !== Role.ADMIN_COMPANY && COMPANY_ROLE_NAMES.includes(role.name),
        );
        await prisma.user.update({
          where: { id: user.id },
          data: {
            roles: {
              disconnect: { id: adminCompanyRole.id },
              ...(keepsCompanyRole || !userCompanyRole ? {} : { connect: { id: userCompanyRole.id } }),
            },
          },
        });
        removed.push(fullName(user));
      }
    }

    const to = fullName(target);
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_OWNERSHIP_TRANSFERRED,
      companyId,
      entityType: "User",
      entityId: target.id,
      summary: `Hizo a ${to} administrador de ${company.name}${removed.length ? ` y quitó el rol a ${removed.join(", ")}` : ""}`,
      metadata: { toUserId: target.id, to, removed },
    });
    return result(
      true,
      removed.length
        ? `${to} ahora administra ${company.name}. Se quitó el rol a ${removed.join(", ")}.`
        : `${to} ahora administra ${company.name}.`,
    );
  },

  /**
   * "Entrar como": devuelve un token de la persona que dura una hora y solo permite ver
   * (`auth/impersonation.ts` bloquea toda mutación). Exige motivo y queda registrado.
   */
  adminStartImpersonation: async (
    _root: unknown,
    { userId, reason }: { userId: string; reason: string },
    context: KeystoneContext,
  ) => {
    const adminId = adminIdOf(context);
    if (!adminId) return { ...NOT_ADMIN, token: null };
    if (getImpersonation(context.session)) {
      return { ...result(false, "Ya estás viendo como otra persona."), token: null };
    }
    if (userId === adminId) return { ...result(false, "No puedes entrar como tú mismo."), token: null };
    const why = cleanReason(reason);
    if (!why) return { ...REASON_REQUIRED, token: null };

    const prisma = prismaOf(context);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        suspendedAt: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
        company: { select: { id: true, name: true, suspendedAt: true } },
      },
    });
    if (!target) return { ...result(false, "No se encontró a la persona."), token: null };
    if (hasPlatformRole(target.roles)) {
      return { ...result(false, "No se puede entrar como alguien del equipo de Kadesh."), token: null };
    }
    if (target.suspendedAt || target.company?.suspendedAt || target.anonymizedAt) {
      return { ...result(false, "La cuenta está suspendida o anonimizada."), token: null };
    }
    if (!context.sessionStrategy) {
      return { ...result(false, "No se pudo iniciar la sesión."), token: null };
    }

    const expiresAt = Date.now() + IMPERSONATION_TTL_MS;
    // `res` falso: el token se devuelve al front; no se pisa la cookie del admin.
    const token = await context.sessionStrategy.start({
      data: { listKey: "User", itemId: target.id, impersonation: { adminId, expiresAt, reason: why } },
      context: { ...context, res: { setHeader() {} } } as any,
    });
    if (typeof token !== "string" || !token) {
      return { ...result(false, "No se pudo iniciar la sesión."), token: null };
    }

    const name = fullName(target);
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_IMPERSONATION_STARTED,
      companyId: target.company?.id ?? null,
      entityType: "User",
      entityId: target.id,
      summary: `Entró como ${name} (solo lectura)`,
      metadata: { reason: why, expiresAt: new Date(expiresAt).toISOString() },
      source: ACTIVITY_SOURCE.ADMIN,
    });

    return {
      success: true,
      message: `Estás viendo el panel como ${name}. Solo lectura, por una hora.`,
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      user: { id: target.id, name: target.name ?? "", lastName: target.lastName ?? null, email: target.email ?? null },
      companyName: target.company?.name ?? null,
    };
  },

  /** Lo llama el front con el token de "entrar como" al salir: registra cuánto duró. */
  endImpersonation: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    const impersonation = getImpersonation(context.session);
    if (!impersonation) return result(false, "No estabas viendo como otra persona.");
    const session = context.session as any;
    const startedAt = impersonation.expiresAt - IMPERSONATION_TTL_MS;
    const minutes = Math.max(0, Math.round((Date.now() - startedAt) / 60_000));
    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_IMPERSONATION_ENDED,
      actorId: impersonation.adminId,
      companyId: session?.data?.company?.id ?? null,
      entityType: "User",
      entityId: session?.itemId ?? null,
      summary: `Salió de la cuenta de ${fullName(session?.data ?? null)} (${minutes} min)`,
      metadata: { minutes },
      source: ACTIVITY_SOURCE.ADMIN,
    });
    return result(true, "Saliste de la cuenta.");
  },

  /**
   * Derecho de acceso (ARCO): todo lo que Kadesh guarda de una persona, en un JSON para
   * entregárselo. Datos bancarios enmascarados; sin contraseña ni tokens.
   */
  adminExportPersonData: async (
    _root: unknown,
    { userId }: { userId: string },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = prismaOf(context);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        secondLastName: true,
        username: true,
        email: true,
        businessEmail: true,
        phone: true,
        businessPhone: true,
        birthday: true,
        verified: true,
        product: true,
        createdAt: true,
        lastLoginAt: true,
        bank: true,
        clabe: true,
        cardNumber: true,
        permissions: true,
        suspendedAt: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new Error("No se encontró a la persona.");

    const [accesses, activity, activeDays, payments, blog] = await Promise.all([
      prisma.userAuthLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { createdAt: true, source: true, step: true, success: true, ip: true, userAgent: true },
      }),
      prisma.activityEvent.findMany({
        where: { actorId: userId },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: { createdAt: true, type: true, summary: true },
      }),
      prisma.userActivityDay.findMany({
        where: { userId },
        orderBy: { day: "desc" },
        take: 400,
        select: { day: true, minutes: true },
      }),
      prisma.saasPayment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, amount: true, status: true, notes: true },
      }),
      prisma.blogSubscription.findMany({
        where: { OR: [{ userId }, ...(user.email ? [{ email: user.email }] : [])] },
        select: { product: true, email: true, active: true, createdAt: true },
      }),
    ]);

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_PERSON_DATA_EXPORTED,
      companyId: user.company?.id ?? null,
      entityType: "User",
      entityId: userId,
      summary: "Exportó los datos personales de una cuenta (ARCO)",
      metadata: { userId },
    });

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: "Kadesh",
      person: {
        ...user,
        clabe: maskTail(user.clabe),
        cardNumber: maskTail(user.cardNumber),
        roles: user.roles.map((role: { name: string }) => role.name),
      },
      accesses,
      activity,
      activeDays: activeDays.map((row: { day: Date; minutes: number | null }) => ({
        day: new Date(row.day).toISOString().slice(0, 10),
        minutes: row.minutes ?? 0,
      })),
      payments: payments.map((row: { createdAt: Date; amount: unknown; status: string | null; notes: string | null }) => ({
        ...row,
        amount: row.amount == null ? null : Number(row.amount),
      })),
      blogSubscriptions: blog,
    };
  },

  /**
   * Derecho de cancelación (ARCO): borra los datos personales de la cuenta y la deja sin acceso.
   * No borra la fila: el CRM de la empresa (actividades, cotizaciones) sigue apuntando a ella y
   * ahora muestra "Usuario eliminado". Irreversible; exige escribir el correo de la cuenta.
   */
  adminAnonymizeUser: async (
    _root: unknown,
    { userId, confirmEmail, reason }: { userId: string; confirmEmail: string; reason: string },
    context: KeystoneContext,
  ) => {
    const adminId = adminIdOf(context);
    if (!adminId) return NOT_ADMIN;
    if (userId === adminId) return result(false, "No puedes anonimizar tu propia cuenta.");
    const why = cleanReason(reason);
    if (!why) return REASON_REQUIRED;

    const prisma = prismaOf(context);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        secondLastName: true,
        email: true,
        companyId: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
      },
    });
    if (!user) return result(false, "No se encontró a la persona.");
    if (hasPlatformRole(user.roles)) return result(false, "No se puede anonimizar a alguien del equipo de Kadesh.");
    if (user.anonymizedAt) return result(false, "La cuenta ya está anonimizada.");
    const email = (user.email ?? "").trim().toLowerCase();
    if (!email || confirmEmail.trim().toLowerCase() !== email) {
      return result(false, "El correo no coincide con el de la cuenta.");
    }

    await anonymizeUserData(context, { ...user, id: userId });

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_USER_ANONYMIZED,
      companyId: user.companyId ?? null,
      entityType: "User",
      entityId: userId,
      summary: "Anonimizó una cuenta a petición de la persona (ARCO)",
      metadata: { reason: why },
    });
    return result(true, "Cuenta anonimizada: se borraron sus datos personales y ya no puede entrar.");
  },
};

export default { typeDefs, definition, resolver };
