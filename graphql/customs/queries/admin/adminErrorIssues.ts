import type { KeystoneContext } from "@keystone-6/core/types";
import { APP_ERROR_TYPES } from "../../../../models/ActivityEvent/constants";
import {
  ERROR_ISSUE_STATUS,
  ERROR_ISSUE_STATUS_VALUES,
} from "../../../../models/ErrorIssue/constants";
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
 * Bandeja de Errores de Operaciones (fase 6.2): los errores de la app (`app.error` del servidor y
 * `app.client_error` del navegador) agrupados por `fingerprint` (mismo tipo, operación y mensaje).
 * Por grupo: cuántas veces, a cuántas personas, primera y última vez, apps, navegadores y la
 * ocurrencia más reciente. El estado (resuelto, ignorado) vive en `ErrorIssue`; si un error
 * resuelto vuelve a pasar, sale como reabierto.
 */

const typeDefs = `
  input AdminErrorIssuesInput {
    """pet-web | business-web | pet-mobile"""
    app: String
    """open (incluye reabiertos) | resolved | ignored | all. Por defecto, open."""
    status: String
    """Días hacia atrás (1-90). Por defecto, 7."""
    days: Int
    """Busca en el mensaje, la operación y la pantalla."""
    search: String
    take: Int
  }

  type AdminErrorIssue {
    fingerprint: ID!
    """app.error (servidor) | app.client_error (navegador)"""
    type: String!
    title: String!
    message: String
    operation: String
    """network | crash | chunk (navegador)"""
    kind: String
    """query | mutation"""
    opType: String
    code: String
    """App de la ocurrencia más reciente."""
    app: String
    apps: [String!]!
    """Pantalla de la ocurrencia más reciente."""
    page: String
    count: Int!
    """Personas con sesión distintas."""
    people: Int!
    """Ocurrencias de visitantes sin sesión."""
    anonymous: Int!
    firstSeen: String!
    lastSeen: String!
    """open | resolved | ignored"""
    status: String!
    """Estaba resuelto y volvió a pasar."""
    reopened: Boolean!
    note: String
    resolvedAt: String
    resolvedBy: AdminPersonRef
    """User agents más comunes (el front los traduce a sistema y navegador)."""
    userAgents: [AdminCount!]!
  }

  type AdminErrorIssuesResult {
    items: [AdminErrorIssue!]!
    """Errores abiertos o reabiertos en el periodo (sin filtro de estado)."""
    openCount: Int!
  }

  type Query {
    adminErrorIssues(input: AdminErrorIssuesInput): AdminErrorIssuesResult!
    """Errores abiertos o reabiertos con actividad en las últimas 24 h (globo del menú)."""
    adminOpenErrorIssuesCount: Int!
  }
`;

const definition = `
  adminErrorIssues(input: AdminErrorIssuesInput): AdminErrorIssuesResult!
  adminOpenErrorIssuesCount: Int!
`;

type Input = {
  app?: string | null;
  status?: string | null;
  days?: number | null;
  search?: string | null;
  take?: number | null;
};

type Group = {
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
};

type IssueRow = {
  fingerprint: string;
  status: string;
  note: string | null;
  resolvedAt: Date | null;
  resolvedBy: { id: string; name?: string | null; lastName?: string | null; email?: string | null } | null;
};

const MAX_GROUPS = 300;
const TOP_USER_AGENTS = 5;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Estado efectivo: un resuelto que volvió a pasar después de resolverse cuenta como abierto. */
function effectiveStatus(issue: IssueRow | undefined, lastSeen: Date) {
  if (!issue) return { status: ERROR_ISSUE_STATUS.OPEN, reopened: false };
  if (
    issue.status === ERROR_ISSUE_STATUS.RESOLVED &&
    issue.resolvedAt &&
    lastSeen.getTime() > new Date(issue.resolvedAt).getTime()
  ) {
    return { status: ERROR_ISSUE_STATUS.OPEN, reopened: true };
  }
  return { status: issue.status, reopened: false };
}

async function loadGroups(prisma: any, where: Record<string, unknown>): Promise<Group[]> {
  if (!prisma?.activityEvent) return [];
  const rows: Array<{
    fingerprint: string | null;
    _count: { _all: number };
    _min: { createdAt: Date | null };
    _max: { createdAt: Date | null };
  }> = await prisma.activityEvent.groupBy({
    by: ["fingerprint"],
    where,
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: MAX_GROUPS,
  });
  return rows
    .filter((row) => row.fingerprint && row._max.createdAt && row._min.createdAt)
    .map((row) => ({
      fingerprint: row.fingerprint as string,
      count: row._count._all,
      firstSeen: row._min.createdAt as Date,
      lastSeen: row._max.createdAt as Date,
    }));
}

async function loadIssues(prisma: any, fingerprints: string[]): Promise<Map<string, IssueRow>> {
  if (!prisma?.errorIssue || fingerprints.length === 0) return new Map();
  const rows: IssueRow[] = await prisma.errorIssue.findMany({
    where: { fingerprint: { in: fingerprints } },
    select: {
      fingerprint: true,
      status: true,
      note: true,
      resolvedAt: true,
      resolvedBy: { select: PERSON_SELECT },
    },
  });
  return new Map(rows.map((row) => [row.fingerprint, row]));
}

function baseWhere(since: Date, app: string | null): Record<string, unknown> {
  return {
    type: { in: [...APP_ERROR_TYPES] },
    createdAt: { gte: since },
    fingerprint: { not: null },
    ...(app ? { app } : {}),
  };
}

/** Cuántos errores siguen abiertos (o se reabrieron) con actividad desde `since`. */
export async function countOpenErrorIssues(prisma: any, since: Date): Promise<number> {
  const groups = await loadGroups(prisma, baseWhere(since, null));
  const issues = await loadIssues(prisma, groups.map((group) => group.fingerprint));
  return groups.filter(
    (group) =>
      effectiveStatus(issues.get(group.fingerprint), group.lastSeen).status ===
      ERROR_ISSUE_STATUS.OPEN,
  ).length;
}

const resolver = {
  adminErrorIssues: async (
    _root: unknown,
    { input }: { input?: Input | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 1, 90, 7);
    const take = clampInt(input?.take, 1, 200, 50);
    const app = input?.app?.trim() || null;
    const statusFilter = input?.status?.trim() || ERROR_ISSUE_STATUS.OPEN;
    const search = input?.search?.trim().toLowerCase() || null;
    const where = baseWhere(daysAgo(days), app);

    const groups = await loadGroups(prisma, where);
    if (groups.length === 0) return { items: [], openCount: 0 };
    const fingerprints = groups.map((group) => group.fingerprint);
    const scoped = { ...where, fingerprint: { in: fingerprints } };

    const [issues, latest, actorGroups, appGroups, uaGroups] = await Promise.all([
      loadIssues(prisma, fingerprints),
      prisma.activityEvent.findMany({
        where: scoped,
        orderBy: { createdAt: "desc" },
        distinct: ["fingerprint"],
        select: {
          fingerprint: true,
          type: true,
          summary: true,
          errorMessage: true,
          metadata: true,
          app: true,
          page: true,
        },
      }),
      prisma.activityEvent.groupBy({ by: ["fingerprint", "actorId"], where: scoped, _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ["fingerprint", "app"], where: scoped, _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ["fingerprint", "userAgent"], where: scoped, _count: { _all: true } }),
    ]);

    const sampleBy = new Map<string, any>(latest.map((row: any) => [row.fingerprint, row]));
    const people = new Map<string, number>();
    const anonymous = new Map<string, number>();
    for (const row of actorGroups as Array<{ fingerprint: string; actorId: string | null; _count: { _all: number } }>) {
      if (row.actorId) people.set(row.fingerprint, (people.get(row.fingerprint) ?? 0) + 1);
      else anonymous.set(row.fingerprint, row._count._all);
    }
    const apps = new Map<string, string[]>();
    for (const row of appGroups as Array<{ fingerprint: string; app: string | null }>) {
      if (!row.app) continue;
      apps.set(row.fingerprint, [...(apps.get(row.fingerprint) ?? []), row.app]);
    }
    const userAgents = new Map<string, Array<{ key: string; count: number }>>();
    for (const row of uaGroups as Array<{ fingerprint: string; userAgent: string | null; _count: { _all: number } }>) {
      if (!row.userAgent) continue;
      const list = userAgents.get(row.fingerprint) ?? [];
      list.push({ key: row.userAgent, count: row._count._all });
      userAgents.set(row.fingerprint, list);
    }

    const all = groups.map((group) => {
      const sample = sampleBy.get(group.fingerprint) ?? {};
      const metadata = (sample.metadata && typeof sample.metadata === "object" ? sample.metadata : {}) as Record<string, unknown>;
      const issue = issues.get(group.fingerprint);
      const { status, reopened } = effectiveStatus(issue, group.lastSeen);
      const legacyKind = text(metadata.kind);
      const opType =
        text(metadata.opType) ?? (legacyKind === "query" || legacyKind === "mutation" ? legacyKind : null);
      return {
        fingerprint: group.fingerprint,
        type: sample.type ?? "app.error",
        title: sample.summary || "Error",
        message: sample.errorMessage ?? null,
        operation: text(metadata.operation),
        kind: legacyKind && legacyKind !== opType ? legacyKind : null,
        opType,
        code: text(metadata.code),
        app: sample.app ?? null,
        apps: apps.get(group.fingerprint) ?? [],
        page: sample.page ?? null,
        count: group.count,
        people: people.get(group.fingerprint) ?? 0,
        anonymous: anonymous.get(group.fingerprint) ?? 0,
        firstSeen: toIso(group.firstSeen) as string,
        lastSeen: toIso(group.lastSeen) as string,
        status,
        reopened,
        note: issue?.note || null,
        resolvedAt: toIso(issue?.resolvedAt ?? null),
        resolvedBy: personRef(issue?.resolvedBy ?? null),
        userAgents: (userAgents.get(group.fingerprint) ?? [])
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_USER_AGENTS),
      };
    });

    const openCount = all.filter((item) => item.status === ERROR_ISSUE_STATUS.OPEN).length;
    const items = all
      .filter((item) =>
        statusFilter === "all" || !ERROR_ISSUE_STATUS_VALUES.has(statusFilter)
          ? true
          : item.status === statusFilter,
      )
      .filter((item) => {
        if (!search) return true;
        return [item.message, item.operation, item.page, item.title]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .slice(0, take);

    return { items, openCount };
  },

  adminOpenErrorIssuesCount: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    return countOpenErrorIssues(adminPrisma(context), daysAgo(1));
  },
};

export default { typeDefs, definition, resolver };
