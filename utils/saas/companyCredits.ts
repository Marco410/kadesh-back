/**
 * Créditos de leads por SaasCompany.
 *
 * Modelo: un SaasCompanyCreditPeriod por mes (planAllowance + bonusAllowance - used).
 * Cada movimiento queda registrado en SaasCompanyCreditLedger.
 * Al cambiar de mes se crea un periodo nuevo con used=0 (reset mensual del plan).
 */
import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../models/Saas/SaasCompanySubscription/constants";
import { COMPANY_CREDIT_LEDGER_TYPE } from "../../models/Saas/SaasCompanyCreditLedger/constants";
import { getFreePlanTrialInfo } from "./freePlanTrial";

/** Snapshot de un periodo mensual de créditos de una empresa. */
export type SaasCompanyCreditPeriodRecord = {
  id: string;
  periodKey: string;
  year: number;
  month: number;
  planAllowance: number | null;
  bonusAllowance: number | null;
  used: number | null;
  subscription?: { id: string } | null;
};

type ActiveSubscription = {
  id: string;
  planLeadLimit: number | null;
  planCost?: number | null;
  activatedAt?: string | null;
  newCreditsAdded?: number | null;
};

/** Devuelve año y mes calendario actuales (mes 1-12). */
export function getCurrentPeriodParts(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Clave única del periodo: `companyId:year:month`. */
export function buildPeriodKey(
  companyId: string,
  year: number,
  month: number,
): string {
  return `${companyId}:${year}:${month}`;
}

/** Límite total del periodo: créditos del plan + bonus comprados. */
function getPeriodAllowance(period: SaasCompanyCreditPeriodRecord): number {
  return (period.planAllowance ?? 0) + (period.bonusAllowance ?? 0);
}

/** Créditos disponibles en el periodo (nunca negativo). */
function getPeriodRemaining(period: SaasCompanyCreditPeriodRecord): number {
  return Math.max(0, getPeriodAllowance(period) - (period.used ?? 0));
}

/** Suscripción ACTIVE o TRIALING más reciente de la empresa. */
async function getActiveSubscription(
  context: KeystoneContext,
  companyId: string,
): Promise<ActiveSubscription | null> {
  const [subscription] = await context
    .sudo()
    .query.SaasCompanySubscription.findMany({
      where: {
        company: { id: { equals: companyId } },
        status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
      },
      orderBy: [{ activatedAt: "desc" }],
      take: 1,
      query: "id planLeadLimit planCost activatedAt newCreditsAdded",
    });

  return (subscription as ActiveSubscription | undefined) ?? null;
}

/**
 * Total acumulado de créditos comprados en la empresa.
 * Migra desde subscription.newCreditsAdded si aún no existe purchasedBonusCredits.
 */
async function getCompanyPurchasedBonus(
  context: KeystoneContext,
  companyId: string,
  subscription: ActiveSubscription | null,
): Promise<number> {
  const company = (await context.sudo().query.SaasCompany.findOne({
    where: { id: companyId },
    query: "id purchasedBonusCredits",
  })) as { purchasedBonusCredits?: number | null } | null;

  let purchasedBonus = company?.purchasedBonusCredits ?? 0;

  if (purchasedBonus < 1 && subscription?.newCreditsAdded) {
    purchasedBonus = subscription.newCreditsAdded;
    await context.sudo().query.SaasCompany.updateOne({
      where: { id: companyId },
      data: { purchasedBonusCredits: purchasedBonus },
    });
  }

  return purchasedBonus;
}

/** Uso del mes en el sistema anterior (SaasCompanyMonthlyLeadSync), para backfill. */
async function getLegacyMonthlyUsed(
  context: KeystoneContext,
  companyId: string,
  year: number,
  month: number,
): Promise<number> {
  const [record] = await context
    .sudo()
    .query.SaasCompanyMonthlyLeadSync.findMany({
      where: {
        company: { id: { equals: companyId } },
        year: { equals: year },
        month: { equals: month },
      },
      take: 1,
      query: "syncedCount",
    });

  return (record as { syncedCount?: number | null } | undefined)?.syncedCount ?? 0;
}

/** Registra un movimiento en SaasCompanyCreditLedger (auditoría). */
async function writeLedgerEntry(
  context: KeystoneContext,
  params: {
    companyId: string;
    periodId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await context.sudo().query.SaasCompanyCreditLedger.createOne({
    data: {
      company: { connect: { id: params.companyId } },
      period: { connect: { id: params.periodId } },
      type: params.type,
      amount: params.amount,
      balanceAfter: params.balanceAfter,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      notes: params.notes ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}

/**
 * Obtiene o crea el periodo de créditos del mes actual.
 * En la primera visita del mes: inicializa allowances, migra uso legacy y escribe ledger.
 */
export async function ensureSaasCompanyCreditPeriod(
  context: KeystoneContext,
  companyId: string,
): Promise<SaasCompanyCreditPeriodRecord> {
  const { year, month } = getCurrentPeriodParts();
  const periodKey = buildPeriodKey(companyId, year, month);

  const [existing] = await context.sudo().query.SaasCompanyCreditPeriod.findMany({
    where: { periodKey: { equals: periodKey } },
    take: 1,
    query:
      "id periodKey year month planAllowance bonusAllowance used subscription { id }",
  });

  if (existing) {
    return existing as SaasCompanyCreditPeriodRecord;
  }

  const subscription = await getActiveSubscription(context, companyId);
  const purchasedBonus = await getCompanyPurchasedBonus(
    context,
    companyId,
    subscription,
  );
  const planAllowance = subscription?.planLeadLimit ?? 0;
  const legacyUsed = await getLegacyMonthlyUsed(context, companyId, year, month);

  const period = (await context.sudo().query.SaasCompanyCreditPeriod.createOne({
    data: {
      company: { connect: { id: companyId } },
      periodKey,
      year,
      month,
      planAllowance,
      bonusAllowance: purchasedBonus,
      used: legacyUsed,
      ...(subscription?.id && {
        subscription: { connect: { id: subscription.id } },
      }),
    },
    query:
      "id periodKey year month planAllowance bonusAllowance used subscription { id }",
  })) as SaasCompanyCreditPeriodRecord;

  const remaining = getPeriodRemaining(period);
  if (planAllowance > 0) {
    await writeLedgerEntry(context, {
      companyId,
      periodId: period.id,
      type: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN,
      amount: planAllowance,
      balanceAfter: remaining,
      referenceType: "subscription",
      referenceId: subscription?.id ?? null,
      notes: "Monthly plan allowance",
    });
  }

  if (purchasedBonus > 0) {
    await writeLedgerEntry(context, {
      companyId,
      periodId: period.id,
      type: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE,
      amount: purchasedBonus,
      balanceAfter: remaining,
      referenceType: "company",
      referenceId: companyId,
      notes: "Purchased bonus credits (period init)",
    });
  }

  if (legacyUsed > 0) {
    await writeLedgerEntry(context, {
      companyId,
      periodId: period.id,
      type: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC,
      amount: -legacyUsed,
      balanceAfter: remaining,
      notes: "Migrated usage from SaasCompanyMonthlyLeadSync",
      metadata: { migrated: true },
    });
  }

  return period;
}

/**
 * Actualiza planAllowance del periodo actual al contratar o cambiar de plan.
 * Usado desde createCompanySubscription.
 */
export async function grantPlanCreditsOnSubscription(
  context: KeystoneContext,
  params: {
    companyId: string;
    subscriptionId: string;
    planLeadLimit: number;
  },
): Promise<SaasCompanyCreditPeriodRecord> {
  const period = await ensureSaasCompanyCreditPeriod(context, params.companyId);
  const previousPlanAllowance = period.planAllowance ?? 0;

  if (previousPlanAllowance === params.planLeadLimit) {
    if (!period.subscription?.id) {
      await context.sudo().query.SaasCompanyCreditPeriod.updateOne({
        where: { id: period.id },
        data: {
          subscription: { connect: { id: params.subscriptionId } },
        },
      });
    }
    return period;
  }

  const updated = (await context.sudo().query.SaasCompanyCreditPeriod.updateOne({
    where: { id: period.id },
    data: {
      planAllowance: params.planLeadLimit,
      subscription: { connect: { id: params.subscriptionId } },
    },
    query:
      "id periodKey year month planAllowance bonusAllowance used subscription { id }",
  })) as SaasCompanyCreditPeriodRecord;

  const delta = params.planLeadLimit - previousPlanAllowance;
  if (delta !== 0) {
    await writeLedgerEntry(context, {
      companyId: params.companyId,
      periodId: updated.id,
      type: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN,
      amount: delta,
      balanceAfter: getPeriodRemaining(updated),
      referenceType: "subscription",
      referenceId: params.subscriptionId,
      notes: "Plan allowance updated on subscription change",
    });
  }

  return updated;
}

/**
 * Suma créditos comprados al total de la empresa y al periodo actual.
 * Los comprados se reaplican cada mes nuevo como bonusAllowance permanente.
 */
export async function grantPurchaseCredits(
  context: KeystoneContext,
  params: {
    companyId: string;
    subscriptionId: string;
    amount: number;
    paymentId?: string | null;
    notes?: string | null;
  },
): Promise<SaasCompanyCreditPeriodRecord> {
  if (params.amount < 1) {
    return ensureSaasCompanyCreditPeriod(context, params.companyId);
  }

  const company = (await context.sudo().query.SaasCompany.findOne({
    where: { id: params.companyId },
    query: "id purchasedBonusCredits",
  })) as { purchasedBonusCredits?: number | null } | null;

  const currentBonus = company?.purchasedBonusCredits ?? 0;
  const nextBonus = currentBonus + params.amount;

  await context.sudo().query.SaasCompany.updateOne({
    where: { id: params.companyId },
    data: { purchasedBonusCredits: nextBonus },
  });

  const period = await ensureSaasCompanyCreditPeriod(context, params.companyId);
  const nextPeriodBonus = (period.bonusAllowance ?? 0) + params.amount;

  const updated = (await context.sudo().query.SaasCompanyCreditPeriod.updateOne({
    where: { id: period.id },
    data: {
      bonusAllowance: nextPeriodBonus,
      subscription: { connect: { id: params.subscriptionId } },
    },
    query:
      "id periodKey year month planAllowance bonusAllowance used subscription { id }",
  })) as SaasCompanyCreditPeriodRecord;

  await writeLedgerEntry(context, {
    companyId: params.companyId,
    periodId: updated.id,
    type: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE,
    amount: params.amount,
    balanceAfter: getPeriodRemaining(updated),
    referenceType: "payment",
    referenceId: params.paymentId ?? null,
    notes: params.notes ?? `Purchased +${params.amount} credits`,
  });

  return updated;
}

/**
 * Descuenta créditos por sincronización de leads.
 * Usa increment atómico vía Prisma cuando está disponible; falla si no hay saldo.
 */
export async function consumeCompanyCredits(
  context: KeystoneContext,
  params: {
    companyId: string;
    amount: number;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
  },
): Promise<{
  success: boolean;
  consumed: number;
  period: SaasCompanyCreditPeriodRecord;
  remainingQuota: number;
  leadLimit: number;
  syncedCount: number;
}> {
  if (params.amount < 1) {
    const period = await ensureSaasCompanyCreditPeriod(context, params.companyId);
    const syncedCount = period.used ?? 0;
    return {
      success: true,
      consumed: 0,
      period,
      remainingQuota: getPeriodRemaining(period),
      leadLimit: getPeriodAllowance(period),
      syncedCount,
    };
  }

  const period = await ensureSaasCompanyCreditPeriod(context, params.companyId);
  const allowance = getPeriodAllowance(period);
  const currentUsed = period.used ?? 0;
  const remaining = allowance - currentUsed;

  if (remaining < params.amount) {
    return {
      success: false,
      consumed: 0,
      period,
      remainingQuota: Math.max(0, remaining),
      leadLimit: allowance,
      syncedCount: currentUsed,
    };
  }

  const prisma = (context as KeystoneContext & { prisma?: any }).prisma;
  let nextUsed = currentUsed + params.amount;

  if (prisma?.saasCompanyCreditPeriod?.updateMany) {
    const updated = await prisma.saasCompanyCreditPeriod.updateMany({
      where: {
        id: period.id,
        used: { lte: allowance - params.amount },
      },
      data: {
        used: { increment: params.amount },
      },
    });

    if (updated.count === 0) {
      const refreshed = await ensureSaasCompanyCreditPeriod(context, params.companyId);
      const refreshedRemaining =
        getPeriodAllowance(refreshed) - (refreshed.used ?? 0);
      return {
        success: false,
        consumed: 0,
        period: refreshed,
        remainingQuota: Math.max(0, refreshedRemaining),
        leadLimit: getPeriodAllowance(refreshed),
        syncedCount: refreshed.used ?? 0,
      };
    }

    const refreshed = (await context.sudo().query.SaasCompanyCreditPeriod.findOne({
      where: { id: period.id },
      query:
        "id periodKey year month planAllowance bonusAllowance used subscription { id }",
    })) as SaasCompanyCreditPeriodRecord;

    nextUsed = refreshed.used ?? nextUsed;

    await writeLedgerEntry(context, {
      companyId: params.companyId,
      periodId: refreshed.id,
      type: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC,
      amount: -params.amount,
      balanceAfter: getPeriodRemaining(refreshed),
      referenceType: params.referenceType ?? "sync",
      referenceId: params.referenceId ?? null,
      notes: params.notes ?? null,
    });

    return {
      success: true,
      consumed: params.amount,
      period: refreshed,
      remainingQuota: getPeriodRemaining(refreshed),
      leadLimit: getPeriodAllowance(refreshed),
      syncedCount: nextUsed,
    };
  }

  const updated = (await context.sudo().query.SaasCompanyCreditPeriod.updateOne({
    where: { id: period.id },
    data: { used: nextUsed },
    query:
      "id periodKey year month planAllowance bonusAllowance used subscription { id }",
  })) as SaasCompanyCreditPeriodRecord;

  await writeLedgerEntry(context, {
    companyId: params.companyId,
    periodId: updated.id,
    type: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC,
    amount: -params.amount,
    balanceAfter: getPeriodRemaining(updated),
    referenceType: params.referenceType ?? "sync",
    referenceId: params.referenceId ?? null,
    notes: params.notes ?? null,
  });

  return {
    success: true,
    consumed: params.amount,
    period: updated,
    remainingQuota: getPeriodRemaining(updated),
    leadLimit: getPeriodAllowance(updated),
    syncedCount: updated.used ?? nextUsed,
  };
}

/** Motivo por el que la empresa no puede consumir créditos. */
export type RemainingCreditsBlockingReason =
  | "no_subscription"
  | "free_plan_expired"
  | "no_lead_limit"
  | "lead_limit_too_low";

/** Resultado de consulta de saldo y elegibilidad de créditos. */
export type RemainingCreditsResult = {
  blockingReason: RemainingCreditsBlockingReason | null;
  remainingQuota: number;
  syncedCount: number;
  leadLimit: number | null;
  planLeadLimit: number | null;
  extraCredits: number;
  periodId: string | null;
  year: number;
  month: number;
};

/**
 * Punto de entrada para saber cuántos créditos le quedan a una empresa.
 * Valida suscripción, trial gratis y luego lee/crea el periodo del mes actual.
 */
export async function getCompanyRemainingCredits(
  context: KeystoneContext,
  companyId: string,
): Promise<RemainingCreditsResult> {
  const { year, month } = getCurrentPeriodParts();

  const empty: RemainingCreditsResult = {
    blockingReason: null,
    remainingQuota: 0,
    syncedCount: 0,
    leadLimit: null,
    planLeadLimit: null,
    extraCredits: 0,
    periodId: null,
    year,
    month,
  };

  const subscription = await getActiveSubscription(context, companyId);
  if (!subscription) {
    return { ...empty, blockingReason: "no_subscription" };
  }

  const isFreePlan = subscription.planCost != null && subscription.planCost <= 0;
  if (isFreePlan && subscription.activatedAt) {
    const { isExpired } = getFreePlanTrialInfo(subscription.activatedAt);
    if (isExpired) {
      return { ...empty, blockingReason: "free_plan_expired", leadLimit: 0 };
    }
  }

  const planLeadLimit = subscription.planLeadLimit ?? null;
  const extraCredits = await getCompanyPurchasedBonus(
    context,
    companyId,
    subscription,
  );

  if (planLeadLimit === null) {
    return {
      ...empty,
      blockingReason: "no_lead_limit",
      planLeadLimit,
      extraCredits,
    };
  }

  if (planLeadLimit < 1 && extraCredits < 1) {
    return {
      ...empty,
      blockingReason: "lead_limit_too_low",
      planLeadLimit,
      extraCredits,
      leadLimit: planLeadLimit + extraCredits,
    };
  }

  const period = await ensureSaasCompanyCreditPeriod(context, companyId);
  const leadLimit = getPeriodAllowance(period);
  const syncedCount = period.used ?? 0;
  const remainingQuota = getPeriodRemaining(period);

  return {
    blockingReason: null,
    remainingQuota,
    syncedCount,
    leadLimit,
    planLeadLimit,
    extraCredits: period.bonusAllowance ?? extraCredits,
    periodId: period.id,
    year,
    month,
  };
}
