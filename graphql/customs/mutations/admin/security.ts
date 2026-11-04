import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { Role } from "../../../../models/Role/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { requestIp } from "../../../../utils/activity/requestMeta";
import { refreshBlockedIps } from "../../../../utils/security/blockedIps";

/**
 * Operaciones → Seguridad (fase 6.5): bloquear o desbloquear una IP. El bloqueo aplica a toda
 * petición a GraphQL desde esa IP (`utils/security/blockedIps.ts`).
 *
 * Para no dejar fuera a Kadesh por error: no se puede bloquear la IP desde la que se hace la
 * petición, y si un admin usó esa IP en los últimos 7 días pide `force` (la UI lo confirma).
 */

const typeDefs = `
  type AdminBlockIpResult {
    success: Boolean!
    message: String!
    """Un admin de Kadesh usó esa IP hace poco: hay que confirmar con force."""
    needsConfirmation: Boolean!
  }

  type Mutation {
    """days: vacío = indefinido."""
    adminBlockIp(ip: String!, reason: String, days: Int, force: Boolean): AdminBlockIpResult!
    adminUnblockIp(ip: String!): AdminOpsActionResult!
  }
`;

const definition = `
  adminBlockIp(ip: String!, reason: String, days: Int, force: Boolean): AdminBlockIpResult!
  adminUnblockIp(ip: String!): AdminOpsActionResult!
`;

const ADMIN_RECENT_DAYS = 7;
const MAX_DAYS = 365;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function cleanIp(value: string | null | undefined): string | null {
  const ip = (value ?? "").trim().replace(/^::ffff:/, "");
  if (!ip || ip.length > 64) return null;
  return IPV4.test(ip) || (IPV6.test(ip) && ip.includes(":")) ? ip : null;
}

function blockResult(success: boolean, message: string, needsConfirmation = false) {
  return { success, message, needsConfirmation };
}

/** ¿Un admin de plataforma usó esta IP en los últimos días? */
async function usedByAdmin(prisma: any, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - ADMIN_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const adminWhere = { roles: { some: { name: Role.ADMIN } } };
  const [event, auth] = await Promise.all([
    prisma.activityEvent
      ? prisma.activityEvent.findFirst({
          where: { ip, createdAt: { gte: since }, actor: adminWhere },
          select: { id: true },
        })
      : null,
    prisma.userAuthLog.findFirst({
      where: { ip, createdAt: { gte: since }, user: adminWhere },
      select: { id: true },
    }),
  ]);
  return Boolean(event || auth);
}

const resolver = {
  adminBlockIp: async (
    _root: unknown,
    args: { ip: string; reason?: string | null; days?: number | null; force?: boolean | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) {
      return blockResult(false, "Solo un administrador de Kadesh puede hacer esto.");
    }
    const ip = cleanIp(args.ip);
    if (!ip) return blockResult(false, "Esa IP no es válida.");
    if (ip === requestIp(context.req)) {
      return blockResult(false, "No puedes bloquear la IP desde la que estás entrando.");
    }
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    if (!prisma?.blockedIp) return blockResult(false, "Falta correr la migración de Seguridad.");
    if (!args.force && (await usedByAdmin(prisma, ip))) {
      return blockResult(
        false,
        `Un admin de Kadesh usó esta IP en los últimos ${ADMIN_RECENT_DAYS} días. Confirma para bloquearla de todos modos.`,
        true,
      );
    }

    const days = args.days && args.days > 0 ? Math.min(Math.round(args.days), MAX_DAYS) : null;
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
    // `reason` es texto no nulo en la base (vacío = sin motivo).
    const reason = args.reason?.trim().slice(0, 500) ?? "";
    const userId = getSessionUserId(context.session);
    const data = {
      reason,
      expiresAt,
      ...(userId ? { createdBy: { connect: { id: userId } } } : {}),
    };
    await prisma.blockedIp.upsert({ where: { ip }, create: { ip, ...data }, update: data });
    await refreshBlockedIps(prisma);

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_IP_BLOCKED,
      companyId: null,
      summary: `Bloqueó la IP ${ip}${days ? ` por ${days} días` : ""}`,
      entityType: "BlockedIp",
      entityId: ip,
      metadata: { ip, days, reason: Boolean(reason) },
    });
    return blockResult(true, days ? `IP bloqueada por ${days} días.` : "IP bloqueada.");
  },

  adminUnblockIp: async (_root: unknown, args: { ip: string }, context: KeystoneContext) => {
    if (!isPlatformAdmin(context.session)) {
      return { success: false, message: "Solo un administrador de Kadesh puede hacer esto." };
    }
    const ip = cleanIp(args.ip);
    if (!ip) return { success: false, message: "Esa IP no es válida." };
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    if (!prisma?.blockedIp) return { success: false, message: "Falta correr la migración de Seguridad." };
    const removed = await prisma.blockedIp.deleteMany({ where: { ip } });
    await refreshBlockedIps(prisma);
    if (!removed?.count) return { success: false, message: "Esa IP no estaba bloqueada." };

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_IP_UNBLOCKED,
      companyId: null,
      summary: `Desbloqueó la IP ${ip}`,
      entityType: "BlockedIp",
      entityId: ip,
      metadata: { ip },
    });
    return { success: true, message: "IP desbloqueada." };
  },
};

export default { typeDefs, definition, resolver };
