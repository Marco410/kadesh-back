import type { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { COMPANY_CREDIT_LEDGER_TYPE } from "../../../../models/Saas/SaasCompanyCreditLedger/constants";
import { SAAS_SUBSCRIPTION_LOG_STEP } from "../../../../models/Saas/SaasSubscriptionLog/constants";
import {
  DAY_MS,
  activeUserIdsSince,
  adminPrisma,
  assertPlatformAdmin,
  companyCredits,
  currentPeriod,
  daysAgo,
  lastSeenByCompany,
  latestDate,
  latestSubscriptionsByCompany,
  monthlyAmount,
  testCompanyIds,
  toIso,
  trialEndDate,
} from "./shared";

const ATTENTION_LIMIT = 25;
const TRIAL_SOON_DAYS = 3;
const INACTIVE_DAYS = 14;

const typeDefs = `
  type AdminMoney {
    currency: String!
    amount: Float!
  }

  type AdminAttentionItem {
    companyId: ID!
    companyName: String!
    """trial_ending | trial_expired | past_due | unpaid | no_credits | sync_failures | checkout_failed | inactive"""
    reason: String!
    detail: String
    """high | medium | low"""
    severity: String!
    at: String
  }

  type AdminOpsSummary {
    companiesTotal: Int!
    """Estado vigente por empresa (sin cuentas de prueba); none = sin suscripción."""
    statusCounts: [AdminCount!]!
    trialsEndingSoon: Int!
    paymentIssues: Int!
    newUsers7d: Int!
    newCompanies7d: Int!
    activeUsers7d: Int!
    syncs24h: Int!
    failedSyncs24h: Int!
    aiCalls7d: Int!
    creditsConsumedMonth: Int!
    """Leads de extracciones de este mes que se crearon nuevos (Google Maps o catálogo INEGI)."""
    leadsCreatedMonth: Int!
    """Leads de este mes que salieron de la base: ya existían, no se le pagó a Google ni a INEGI por ellos."""
    leadsReusedMonth: Int!
    """MRR estimado por moneda: suscripciones activas normalizadas a mes."""
    mrr: [AdminMoney!]!
    attention: [AdminAttentionItem!]!
  }

  type Query {
    adminOpsSummary: AdminOpsSummary!
  }
`;

const definition = `
  adminOpsSummary: AdminOpsSummary!
`;

type AttentionItem = {
  companyId: string;
  companyName: string;
  reason: string;
  detail: string | null;
  severity: "high" | "medium" | "low";
  at: string | null;
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function formatDay(date: Date) {
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City",
  });
}

const resolver = {
  adminOpsSummary: async (
    _root: unknown,
    _args: unknown,
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since7d = daysAgo(7, now);
    const sinceInactive = daysAgo(INACTIVE_DAYS, now);
    const { year, month } = currentPeriod();
    const monthStart = new Date(year, month - 1, 1);

    const testIds = await testCompanyIds(prisma);
    const companies: Array<{
      id: string;
      name: string;
      createdAt: Date | null;
      purchasedBonusCredits: number | null;
      plan: { leadLimit: number | null } | null;
      creditPeriods: Array<{ planAllowance: number | null; bonusAllowance: number | null; used: number | null }>;
    }> = await prisma.saasCompany.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        purchasedBonusCredits: true,
        plan: { select: { leadLimit: true } },
        creditPeriods: {
          where: { year, month },
          take: 1,
          select: { planAllowance: true, bonusAllowance: true, used: true },
        },
      },
    });
    const real = companies.filter((c) => !testIds.has(c.id));
    const realIds = real.map((c) => c.id);
    const nameById = new Map(real.map((c) => [c.id, c.name]));
    const latest = await latestSubscriptionsByCompany(prisma, realIds);

    const statusCounts = new Map<string, number>();
    const mrr = new Map<string, number>();
    const attention: AttentionItem[] = [];
    let trialsEndingSoon = 0;
    let paymentIssues = 0;

    for (const company of real) {
      const sub = latest.get(company.id);
      const status = sub?.status ?? "none";
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

      if (sub?.status === SUBSCRIPTION_STATUS.ACTIVE) {
        const amount = monthlyAmount(sub.planCost, sub.planFrequency);
        if (amount > 0) {
          const currency = (sub.planCurrency || "mxn").toUpperCase();
          mrr.set(currency, (mrr.get(currency) ?? 0) + amount);
        }
      }

      if (sub?.status === SUBSCRIPTION_STATUS.PAST_DUE || sub?.status === SUBSCRIPTION_STATUS.UNPAID) {
        paymentIssues += 1;
        attention.push({
          companyId: company.id,
          companyName: company.name,
          reason: sub.status,
          detail: sub.planName ? `Plan ${sub.planName}` : null,
          severity: "high",
          at: toIso(sub.currentPeriodEnd),
        });
      }

      const trialEnd = trialEndDate(sub);
      if (trialEnd) {
        const msLeft = trialEnd.getTime() - now.getTime();
        if (msLeft < 0) {
          attention.push({
            companyId: company.id,
            companyName: company.name,
            reason: "trial_expired",
            detail: `Terminó el ${formatDay(trialEnd)}`,
            severity: "high",
            at: toIso(trialEnd),
          });
        } else if (msLeft <= TRIAL_SOON_DAYS * DAY_MS) {
          trialsEndingSoon += 1;
          attention.push({
            companyId: company.id,
            companyName: company.name,
            reason: "trial_ending",
            detail: `Vence el ${formatDay(trialEnd)}`,
            severity: "medium",
            at: toIso(trialEnd),
          });
        }
      }

      const isLive =
        sub?.status === SUBSCRIPTION_STATUS.ACTIVE ||
        sub?.status === SUBSCRIPTION_STATUS.TRIALING;
      if (isLive) {
        const credits = companyCredits({
          period: company.creditPeriods[0] ?? null,
          planLeadLimit: sub?.planLeadLimit ?? company.plan?.leadLimit ?? null,
          purchasedBonusCredits: company.purchasedBonusCredits,
        });
        if (credits.plan + credits.bonus > 0 && credits.remaining === 0) {
          attention.push({
            companyId: company.id,
            companyName: company.name,
            reason: "no_credits",
            detail: `Usó ${credits.used} de ${credits.plan + credits.bonus} este mes`,
            severity: "medium",
            at: null,
          });
        }
      }
    }

    const [failedSyncGroups, checkoutFailures, checkoutSuccesses, recentLogins] =
      await Promise.all([
        prisma.techLeadSyncLog.groupBy({
          by: ["companyId"],
          where: { success: false, createdAt: { gte: since7d }, companyId: { in: realIds } },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        prisma.saasSubscriptionLog.groupBy({
          by: ["companyId"],
          where: {
            success: false,
            createdAt: { gte: since7d },
            companyId: { in: realIds },
            step: { notIn: [SAAS_SUBSCRIPTION_LOG_STEP.SESSION_MISMATCH] },
          },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        prisma.saasSubscriptionLog.groupBy({
          by: ["companyId"],
          where: { success: true, createdAt: { gte: since7d }, companyId: { in: realIds } },
          _max: { createdAt: true },
        }),
        prisma.user.groupBy({
          by: ["companyId"],
          where: { companyId: { in: realIds } },
          _max: { lastLoginAt: true },
        }),
      ]);

    for (const row of failedSyncGroups as Array<{ companyId: string; _count: { _all: number }; _max: { createdAt: Date | null } }>) {
      if (row._count._all < 2) continue;
      attention.push({
        companyId: row.companyId,
        companyName: nameById.get(row.companyId) ?? "Empresa",
        reason: "sync_failures",
        detail: `${row._count._all} extracciones fallidas en 7 días`,
        severity: "medium",
        at: toIso(row._max.createdAt),
      });
    }

    const lastSuccess = new Map(
      (checkoutSuccesses as Array<{ companyId: string; _max: { createdAt: Date | null } }>).map(
        (row) => [row.companyId, row._max.createdAt?.getTime() ?? 0],
      ),
    );
    for (const row of checkoutFailures as Array<{ companyId: string; _count: { _all: number }; _max: { createdAt: Date | null } }>) {
      const failedAt = row._max.createdAt?.getTime() ?? 0;
      if ((lastSuccess.get(row.companyId) ?? 0) > failedAt) continue;
      attention.push({
        companyId: row.companyId,
        companyName: nameById.get(row.companyId) ?? "Empresa",
        reason: "checkout_failed",
        detail: `${row._count._all} intento${row._count._all === 1 ? "" : "s"} de pago sin completar`,
        severity: "medium",
        at: toIso(row._max.createdAt),
      });
    }

    const lastLoginByCompany = new Map(
      (recentLogins as Array<{ companyId: string; _max: { lastLoginAt: Date | null } }>).map(
        (row) => [row.companyId, row._max.lastLoginAt],
      ),
    );
    // La sesión dura 30 días: sin el latido, un equipo que usa el panel a diario sin volver a
    // iniciar sesión salía como "inactivo".
    const lastSeen = await lastSeenByCompany(prisma, realIds);
    for (const company of real) {
      const sub = latest.get(company.id);
      if (sub?.status !== SUBSCRIPTION_STATUS.ACTIVE) continue;
      const last = latestDate(lastLoginByCompany.get(company.id), lastSeen.get(company.id));
      if (last && last >= sinceInactive) continue;
      attention.push({
        companyId: company.id,
        companyName: company.name,
        reason: "inactive",
        detail: last
          ? `Último acceso ${formatDay(last)}`
          : "Nadie del equipo ha entrado",
        severity: "low",
        at: toIso(last),
      });
    }

    const seenUserIds = await activeUserIdsSince(prisma, since7d);
    const [
      newUsers7d,
      newCompanies7d,
      activeUsers7d,
      syncs24h,
      failedSyncs24h,
      aiCalls7d,
      consumed,
      extractionMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since7d }, userTest: false } }),
      Promise.resolve(real.filter((c) => c.createdAt && c.createdAt >= since7d).length),
      prisma.user.count({
        where: {
          userTest: false,
          OR: [
            { lastLoginAt: { gte: since7d } },
            ...(seenUserIds.length ? [{ id: { in: seenUserIds } }] : []),
          ],
        },
      }),
      prisma.techLeadSyncLog.count({ where: { createdAt: { gte: since24h }, companyId: { in: realIds } } }),
      prisma.techLeadSyncLog.count({
        where: { createdAt: { gte: since24h }, success: false, companyId: { in: realIds } },
      }),
      prisma.techAiCallLog.count({ where: { createdAt: { gte: since7d }, companyId: { in: realIds } } }),
      prisma.saasCompanyCreditLedger.aggregate({
        where: {
          createdAt: { gte: monthStart },
          companyId: { in: realIds },
          type: {
            in: [COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC, COMPANY_CREDIT_LEDGER_TYPE.CONSUME_AI],
          },
        },
        _sum: { amount: true },
      }),
      // Reutilizar leads que ya existen es lo que ahorra llamadas a Google Maps / INEGI.
      prisma.techLeadSyncLog.aggregate({
        where: { createdAt: { gte: monthStart }, success: true, companyId: { in: realIds } },
        _sum: { created: true, alreadyInDb: true },
      }),
    ]);

    attention.sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.at ?? "").localeCompare(a.at ?? ""),
    );

    return {
      companiesTotal: real.length,
      statusCounts: [...statusCounts.entries()].map(([key, count]) => ({ key, count })),
      trialsEndingSoon,
      paymentIssues,
      newUsers7d,
      newCompanies7d,
      activeUsers7d,
      syncs24h,
      failedSyncs24h,
      aiCalls7d,
      creditsConsumedMonth: Math.abs(consumed?._sum?.amount ?? 0),
      leadsCreatedMonth: extractionMonth?._sum?.created ?? 0,
      leadsReusedMonth: extractionMonth?._sum?.alreadyInDb ?? 0,
      mrr: [...mrr.entries()].map(([currency, amount]) => ({
        currency,
        amount: Math.round(amount * 100) / 100,
      })),
      attention: attention.slice(0, ATTENTION_LIMIT),
    };
  },
};

export default { typeDefs, definition, resolver };
