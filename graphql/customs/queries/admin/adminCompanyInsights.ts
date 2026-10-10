import type { KeystoneContext } from "@keystone-6/core/types";
import { COMPANY_CREDIT_LEDGER_TYPE } from "../../../../models/Saas/SaasCompanyCreditLedger/constants";
import {
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  countsToList,
  crmCompanyScope,
  DAY_MS,
  daysAgo,
  toIso,
  toMxDay,
} from "./shared";

const FOLLOW_UP_PENDING = "Pendiente";
const WHATSAPP_OUTBOUND = "outbound";
const WHATSAPP_INBOUND = "inbound";
const WHATSAPP_FAILED = "failed";

const typeDefs = `
  type AdminTeamMemberStats {
    userId: ID!
    """Accesos correctos en la ventana (login, alta)."""
    logins: Int!
    failedLogins: Int!
    lastLoginAt: String
    """Última acción registrada (acceso, extracción, IA, CRM, WhatsApp)."""
    lastActivityAt: String
    leadsAssigned: Int!
    activities: Int!
    quotations: Int!
    extractions: Int!
    aiCalls: Int!
    whatsappSent: Int!
    toursCompleted: Int!
    toursSkipped: Int!
  }

  type AdminExtractionStats {
    runs: Int!
    failed: Int!
    created: Int!
    alreadyInDb: Int!
    creditsUsed: Int!
  }

  type AdminDayValue {
    date: String!
    value: Int!
  }

  type AdminFeatureUsage {
    feature: String!
    calls: Int!
    credits: Int!
  }

  type AdminAiStats {
    calls: Int!
    failed: Int!
    credits: Int!
    byFeature: [AdminFeatureUsage!]!
  }

  type AdminWhatsappStats {
    outbound: Int!
    inbound: Int!
    failed: Int!
    lastMessageAt: String
  }

  type AdminCompanyInsights {
    companyId: ID!
    days: Int!
    lastActivityAt: String
    team: [AdminTeamMemberStats!]!
    """Leads por etapa del pipeline (estatus de esta empresa)."""
    pipeline: [AdminCount!]!
    leadsTotal: Int!
    leadsWithoutOwner: Int!
    extraction: AdminExtractionStats!
    """Créditos gastados por día (sync + IA), hora de CDMX."""
    creditsByDay: [AdminDayValue!]!
    ai: AdminAiStats!
    activitiesByType: [AdminCount!]!
    followUpsPending: Int!
    followUpsOverdue: Int!
    proposalsByStatus: [AdminAmountCount!]!
    quotationsByStatus: [AdminAmountCount!]!
    whatsapp: AdminWhatsappStats!
    calendarAccounts: Int!
    calendarLastSyncedAt: String
    calendarLastError: String
    checkoutFailures: Int!
  }

  type Query {
    adminCompanyInsights(companyId: ID!, days: Int): AdminCompanyInsights!
  }
`;

const definition = `
  adminCompanyInsights(companyId: ID!, days: Int): AdminCompanyInsights!
`;

type GroupRow = {
  _count: { _all: number };
  _max?: { createdAt?: Date | null };
  [key: string]: unknown;
};

function groupMap(rows: GroupRow[], key: string) {
  const map = new Map<string, { count: number; last: Date | null }>();
  for (const row of rows) {
    const id = row[key];
    if (typeof id !== "string") continue;
    map.set(id, { count: row._count._all, last: row._max?.createdAt ?? null });
  }
  return map;
}

function maxDate(...dates: Array<Date | null | undefined>): Date | null {
  return dates.reduce<Date | null>(
    (max, d) => (d && (!max || d > max) ? d : max),
    null,
  );
}

function tourCounts(state: unknown) {
  let completed = 0;
  let skipped = 0;
  if (state && typeof state === "object") {
    for (const value of Object.values(state as Record<string, unknown>)) {
      const status = (value as { status?: unknown } | null)?.status;
      if (status === "completed") completed += 1;
      if (status === "skipped") skipped += 1;
    }
  }
  return { completed, skipped };
}

const resolver = {
  adminCompanyInsights: async (
    _root: unknown,
    { companyId, days }: { companyId: string; days?: number | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const windowDays = clampInt(days, 1, 365, 30);
    const now = new Date();
    const since = daysAgo(windowDays, now);
    const todayMx = toMxDay(now);
    const todayStart = new Date(`${todayMx}T00:00:00.000Z`);
    const crmScope = crmCompanyScope(companyId);

    const users: Array<{
      id: string;
      lastLoginAt: Date | null;
      onboardingState: unknown;
    }> = await prisma.user.findMany({
      where: { companyId },
      select: { id: true, lastLoginAt: true, onboardingState: true },
    });
    const userIds = users.map((u) => u.id);

    const [
      authGroups,
      leadsAssigned,
      activityGroups,
      quotationGroups,
      extractionGroups,
      aiGroups,
      whatsappGroups,
    ] = await Promise.all([
      prisma.userAuthLog.groupBy({
        by: ["userId", "success"],
        where: { userId: { in: userIds }, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.techStatusBusinessLead.groupBy({
        by: ["salesPersonId"],
        where: { saasCompanyId: companyId, salesPersonId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.techSalesActivity.groupBy({
        by: ["createdById"],
        where: { AND: [crmScope, { createdAt: { gte: since } }] },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.saasQuotation.groupBy({
        by: ["createdById"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.techLeadSyncLog.groupBy({
        by: ["userId"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.techAiCallLog.groupBy({
        by: ["userId"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.techWhatsAppMessage.groupBy({
        by: ["sentById"],
        where: { companyId, direction: WHATSAPP_OUTBOUND, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    const loginsOk = groupMap(
      (authGroups as Array<GroupRow & { success: boolean }>).filter((r) => r.success),
      "userId",
    );
    const loginsFail = groupMap(
      (authGroups as Array<GroupRow & { success: boolean }>).filter((r) => !r.success),
      "userId",
    );
    const assigned = groupMap(leadsAssigned as GroupRow[], "salesPersonId");
    const activities = groupMap(activityGroups as GroupRow[], "createdById");
    const quotations = groupMap(quotationGroups as GroupRow[], "createdById");
    const extractions = groupMap(extractionGroups as GroupRow[], "userId");
    const aiCalls = groupMap(aiGroups as GroupRow[], "userId");
    const whatsappSent = groupMap(whatsappGroups as GroupRow[], "sentById");

    const team = users.map((user) => {
      const tours = tourCounts(user.onboardingState);
      const lastActivity = maxDate(
        loginsOk.get(user.id)?.last,
        activities.get(user.id)?.last,
        quotations.get(user.id)?.last,
        extractions.get(user.id)?.last,
        aiCalls.get(user.id)?.last,
        whatsappSent.get(user.id)?.last,
      );
      return {
        userId: user.id,
        logins: loginsOk.get(user.id)?.count ?? 0,
        failedLogins: loginsFail.get(user.id)?.count ?? 0,
        lastLoginAt: toIso(user.lastLoginAt),
        lastActivityAt: toIso(lastActivity),
        leadsAssigned: assigned.get(user.id)?.count ?? 0,
        activities: activities.get(user.id)?.count ?? 0,
        quotations: quotations.get(user.id)?.count ?? 0,
        extractions: extractions.get(user.id)?.count ?? 0,
        aiCalls: aiCalls.get(user.id)?.count ?? 0,
        whatsappSent: whatsappSent.get(user.id)?.count ?? 0,
        toursCompleted: tours.completed,
        toursSkipped: tours.skipped,
      };
    });

    const consumeTypes = [
      COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC,
      COMPANY_CREDIT_LEDGER_TYPE.CONSUME_AI,
    ];

    const [
      pipelineGroups,
      leadsTotal,
      leadsWithoutOwner,
      extractionAgg,
      extractionFailed,
      syncCreditsAgg,
      consumeRows,
      aiFeatureGroups,
      aiFailed,
      activityTypeGroups,
      followUpsPending,
      followUpsOverdue,
      proposalGroups,
      quotationStatusGroups,
      whatsappDirectionGroups,
      whatsappFailed,
      whatsappLast,
      calendarAccounts,
      checkoutFailures,
    ] = await Promise.all([
      prisma.techStatusBusinessLead.groupBy({
        by: ["pipelineStatus"],
        where: { saasCompanyId: companyId },
        _count: { _all: true },
      }),
      prisma.techBusinessLead.count({
        where: { saasCompany: { some: { id: companyId } } },
      }),
      prisma.techStatusBusinessLead.count({
        where: { saasCompanyId: companyId, salesPersonId: null },
      }),
      prisma.techLeadSyncLog.aggregate({
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { created: true, alreadyInDb: true },
      }),
      prisma.techLeadSyncLog.count({
        where: { companyId, createdAt: { gte: since }, success: false },
      }),
      prisma.saasCompanyCreditLedger.aggregate({
        where: {
          companyId,
          createdAt: { gte: since },
          type: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC,
        },
        _sum: { amount: true },
      }),
      prisma.saasCompanyCreditLedger.findMany({
        where: { companyId, createdAt: { gte: since }, type: { in: consumeTypes } },
        select: { amount: true, createdAt: true },
      }),
      prisma.techAiCallLog.groupBy({
        by: ["feature"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { creditsCharged: true },
      }),
      prisma.techAiCallLog.count({
        where: { companyId, createdAt: { gte: since }, success: false },
      }),
      prisma.techSalesActivity.groupBy({
        by: ["type"],
        where: { AND: [crmScope, { createdAt: { gte: since } }] },
        _count: { _all: true },
      }),
      prisma.techFollowUpTask.count({
        where: { AND: [crmScope, { status: FOLLOW_UP_PENDING }] },
      }),
      prisma.techFollowUpTask.count({
        where: {
          AND: [crmScope, { status: FOLLOW_UP_PENDING }, { scheduledDate: { lt: todayStart } }],
        },
      }),
      prisma.techProposal.groupBy({
        by: ["status"],
        where: crmScope,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.saasQuotation.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.techWhatsAppMessage.groupBy({
        by: ["direction"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.techWhatsAppMessage.count({
        where: { companyId, createdAt: { gte: since }, status: WHATSAPP_FAILED },
      }),
      prisma.techWhatsAppMessage.aggregate({
        where: { companyId },
        _max: { createdAt: true },
      }),
      prisma.googleCalendarAccount.findMany({
        where: { OR: [{ companyId }, { user: { companyId } }] },
        orderBy: { lastSyncedAt: { sort: "desc", nulls: "last" } },
        select: { lastSyncedAt: true, lastSyncError: true, isActive: true },
      }),
      prisma.saasSubscriptionLog.count({
        where: { companyId, createdAt: { gte: since }, success: false },
      }),
    ]);

    // Serie diaria completa (días sin gasto en 0) para la gráfica del 360.
    const byDay = new Map<string, number>();
    for (const row of consumeRows as Array<{ amount: number; createdAt: Date | null }>) {
      if (!row.createdAt) continue;
      const day = toMxDay(row.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(row.amount));
    }
    const creditsByDay: Array<{ date: string; value: number }> = [];
    for (let i = windowDays - 1; i >= 0; i -= 1) {
      const day = toMxDay(new Date(now.getTime() - i * DAY_MS));
      creditsByDay.push({ date: day, value: byDay.get(day) ?? 0 });
    }

    const whatsappDirections = new Map(
      (whatsappDirectionGroups as Array<{ direction: string; _count: { _all: number } }>).map(
        (row) => [row.direction, row._count._all],
      ),
    );

    const accounts = calendarAccounts as Array<{
      lastSyncedAt: Date | null;
      lastSyncError: string | null;
      isActive: boolean;
    }>;
    const accountWithError = accounts.find((a) => a.lastSyncError);

    const companyLastActivity = maxDate(
      ...team.map((m) => (m.lastActivityAt ? new Date(m.lastActivityAt) : null)),
    );

    return {
      companyId,
      days: windowDays,
      lastActivityAt: toIso(companyLastActivity),
      team,
      pipeline: countsToList(
        (pipelineGroups as Array<{ pipelineStatus: string | null; _count: { _all: number } }>).map(
          (row) => ({ key: row.pipelineStatus, count: row._count._all }),
        ),
      ),
      leadsTotal,
      leadsWithoutOwner,
      extraction: {
        runs: extractionAgg?._count?._all ?? 0,
        failed: extractionFailed,
        created: extractionAgg?._sum?.created ?? 0,
        alreadyInDb: extractionAgg?._sum?.alreadyInDb ?? 0,
        creditsUsed: Math.abs(syncCreditsAgg?._sum?.amount ?? 0),
      },
      creditsByDay,
      ai: {
        calls: (aiFeatureGroups as Array<{ _count: { _all: number } }>).reduce(
          (sum, row) => sum + row._count._all,
          0,
        ),
        failed: aiFailed,
        credits: (aiFeatureGroups as Array<{ _sum: { creditsCharged: number | null } }>).reduce(
          (sum, row) => sum + (row._sum.creditsCharged ?? 0),
          0,
        ),
        byFeature: (
          aiFeatureGroups as Array<{
            feature: string | null;
            _count: { _all: number };
            _sum: { creditsCharged: number | null };
          }>
        )
          .map((row) => ({
            feature: row.feature ?? "otro",
            calls: row._count._all,
            credits: row._sum.creditsCharged ?? 0,
          }))
          .sort((a, b) => b.calls - a.calls),
      },
      activitiesByType: countsToList(
        (activityTypeGroups as Array<{ type: string; _count: { _all: number } }>).map((row) => ({
          key: row.type,
          count: row._count._all,
        })),
      ),
      followUpsPending,
      followUpsOverdue,
      proposalsByStatus: (
        proposalGroups as Array<{ status: string | null; _count: { _all: number }; _sum: { amount: number | null } }>
      ).map((row) => ({
        key: row.status ?? "",
        count: row._count._all,
        amount: row._sum.amount ?? 0,
      })),
      quotationsByStatus: (
        quotationStatusGroups as Array<{ status: string | null; _count: { _all: number }; _sum: { total: number | null } }>
      ).map((row) => ({
        key: row.status ?? "",
        count: row._count._all,
        amount: row._sum.total ?? 0,
      })),
      whatsapp: {
        outbound: whatsappDirections.get(WHATSAPP_OUTBOUND) ?? 0,
        inbound: whatsappDirections.get(WHATSAPP_INBOUND) ?? 0,
        failed: whatsappFailed,
        lastMessageAt: toIso(whatsappLast?._max?.createdAt ?? null),
      },
      calendarAccounts: accounts.length,
      calendarLastSyncedAt: toIso(accounts[0]?.lastSyncedAt ?? null),
      calendarLastError: accountWithError?.lastSyncError ?? null,
      checkoutFailures,
    };
  },
};

export default { typeDefs, definition, resolver };
