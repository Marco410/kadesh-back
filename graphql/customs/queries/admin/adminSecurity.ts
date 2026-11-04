import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { USER_AUTH_LOG_STEP } from "../../../../models/User/UserAuthLog/constants";
import { RATE_LIMIT_RULE_LABELS } from "../../../../utils/security/constants";
import { isIpBlocked } from "../../../../utils/security/blockedIps";
import {
  PERSON_SELECT,
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  daysAgo,
  personRef,
  toIso,
} from "./shared";

/**
 * Operaciones → Seguridad (fase 6.5):
 * - límites rebasados (`security.rate_limited`) por IP, persona y regla;
 * - IPs con varias cuentas nuevas (posibles multicuentas o bots);
 * - IPs bloqueadas.
 */

const typeDefs = `
  type AdminRateLimitHit {
    ip: String
    rule: String!
    ruleLabel: String!
    actor: AdminPersonRef
    """Veces que se pasó del límite en el periodo."""
    count: Int!
    lastAt: String!
    blocked: Boolean!
  }

  type AdminSignupIp {
    ip: String!
    accounts: Int!
    lastAt: String!
    blocked: Boolean!
  }

  type AdminSecuritySummary {
    rateLimited: [AdminRateLimitHit!]!
    signupIps: [AdminSignupIp!]!
    blockedCount: Int!
  }

  type AdminBlockedIp {
    id: ID!
    ip: String!
    reason: String
    expiresAt: String
    createdAt: String!
    createdBy: AdminPersonRef
    """Sigue vigente (sin fecha o con fecha futura)."""
    active: Boolean!
  }

  type Query {
    """Días hacia atrás (1-90). Por defecto, 7."""
    adminSecuritySummary(days: Int): AdminSecuritySummary!
    adminBlockedIps: [AdminBlockedIp!]!
  }
`;

const definition = `
  adminSecuritySummary(days: Int): AdminSecuritySummary!
  adminBlockedIps: [AdminBlockedIp!]!
`;

const MAX_EVENTS = 1000;
const TOP = 30;
const SIGNUP_STEPS = [
  USER_AUTH_LOG_STEP.REGISTER_SUCCESS,
  USER_AUTH_LOG_STEP.CUSTOM_AUTH_SIGNUP,
  USER_AUTH_LOG_STEP.GOOGLE_AUTH_SIGNUP,
];

const resolver = {
  adminSecuritySummary: async (
    _root: unknown,
    { days }: { days?: number | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const since = daysAgo(clampInt(days, 1, 90, 7));

    const [limitEvents, authSignups, eventSignups, blockedCount] = await Promise.all([
      prisma.activityEvent
        ? prisma.activityEvent.findMany({
            where: { type: ACTIVITY_EVENT.SECURITY_RATE_LIMITED, createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            take: MAX_EVENTS,
            select: { ip: true, metadata: true, createdAt: true, actor: { select: PERSON_SELECT } },
          })
        : [],
      prisma.userAuthLog.findMany({
        where: { step: { in: SIGNUP_STEPS }, success: true, ip: { not: null }, createdAt: { gte: since } },
        take: MAX_EVENTS,
        select: { ip: true, userId: true, createdAt: true },
      }),
      prisma.activityEvent
        ? prisma.activityEvent.findMany({
            where: { type: ACTIVITY_EVENT.AUTH_SIGNUP, ip: { not: null }, createdAt: { gte: since } },
            take: MAX_EVENTS,
            select: { ip: true, actorId: true, createdAt: true },
          })
        : [],
      prisma.blockedIp ? prisma.blockedIp.count() : 0,
    ]);

    type Hit = {
      ip: string | null;
      rule: string;
      actor: { id: string; name?: string | null; lastName?: string | null; email?: string | null } | null;
      count: number;
      lastAt: Date;
    };
    const hits = new Map<string, Hit>();
    for (const event of limitEvents as Array<{
      ip: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      actor: Hit["actor"];
    }>) {
      const rule = typeof event.metadata?.rule === "string" ? event.metadata.rule : "desconocida";
      const key = `${event.ip ?? ""}|${rule}|${event.actor?.id ?? ""}`;
      const current = hits.get(key);
      if (current) {
        current.count += 1;
        if (event.createdAt > current.lastAt) current.lastAt = event.createdAt;
      } else {
        hits.set(key, { ip: event.ip, rule, actor: event.actor, count: 1, lastAt: event.createdAt });
      }
    }
    const rateLimited = [...hits.values()]
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
      .slice(0, TOP)
      .map((hit) => ({
        ip: hit.ip,
        rule: hit.rule,
        ruleLabel: RATE_LIMIT_RULE_LABELS[hit.rule] ?? hit.rule,
        actor: personRef(hit.actor),
        count: hit.count,
        lastAt: toIso(hit.lastAt) as string,
        blocked: isIpBlocked(hit.ip),
      }));

    const byIp = new Map<string, { accounts: Set<string>; lastAt: Date }>();
    const addSignup = (ip: string | null, userId: string | null, at: Date) => {
      if (!ip || !userId) return;
      const current = byIp.get(ip) ?? { accounts: new Set<string>(), lastAt: at };
      current.accounts.add(userId);
      if (at > current.lastAt) current.lastAt = at;
      byIp.set(ip, current);
    };
    for (const row of authSignups as Array<{ ip: string | null; userId: string | null; createdAt: Date }>) {
      addSignup(row.ip, row.userId, row.createdAt);
    }
    for (const row of eventSignups as Array<{ ip: string | null; actorId: string | null; createdAt: Date }>) {
      addSignup(row.ip, row.actorId, row.createdAt);
    }
    const signupIps = [...byIp.entries()]
      .filter(([, data]) => data.accounts.size >= 2)
      .sort((a, b) => b[1].accounts.size - a[1].accounts.size || b[1].lastAt.getTime() - a[1].lastAt.getTime())
      .slice(0, TOP)
      .map(([ip, data]) => ({
        ip,
        accounts: data.accounts.size,
        lastAt: toIso(data.lastAt) as string,
        blocked: isIpBlocked(ip),
      }));

    return { rateLimited, signupIps, blockedCount };
  },

  adminBlockedIps: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    if (!prisma.blockedIp) return [];
    const rows: Array<{
      id: string;
      ip: string;
      reason: string | null;
      expiresAt: Date | null;
      createdAt: Date;
      createdBy: { id: string; name?: string | null; lastName?: string | null; email?: string | null } | null;
    }> = await prisma.blockedIp.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        ip: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: PERSON_SELECT },
      },
    });
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      ip: row.ip,
      reason: row.reason || null,
      expiresAt: toIso(row.expiresAt),
      createdAt: toIso(row.createdAt) as string,
      createdBy: personRef(row.createdBy),
      active: !row.expiresAt || new Date(row.expiresAt).getTime() > now,
    }));
  },
};

export default { typeDefs, definition, resolver };
