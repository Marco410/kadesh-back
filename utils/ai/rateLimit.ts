import { KeystoneContext } from "@keystone-6/core/types";
import {
  AI_BILLING_MODE,
  AI_RATE_LIMIT,
  AI_RATE_LIMIT_ERROR_PREFIX,
  MANAGED_GEMINI_FALLBACK,
  type AiBillingMode,
  type ManagedGeminiQuota,
} from "./constants";
import { AiProviderError, AiRateLimitError } from "./errors";

type UsageRow = {
  _count: { _all: number };
  _sum: { inputTokens: number | null };
};

export function getManagedGeminiChain(preferred?: string): ManagedGeminiQuota[] {
  const chain = [...MANAGED_GEMINI_FALLBACK];
  const wanted = preferred?.trim();
  if (!wanted) return chain;

  const idx = chain.findIndex((item) => item.model === wanted);
  if (idx === 0) return chain;
  if (idx > 0) {
    return [...chain.slice(idx), ...chain.slice(0, idx)];
  }
  return [
    { model: wanted, rpm: 15, tpmInput: 250_000, rpd: 500 },
    ...chain,
  ];
}

function notRateLimitedWhere() {
  return {
    OR: [
      { errorMessage: { equals: null } },
      { errorMessage: { not: { startsWith: AI_RATE_LIMIT_ERROR_PREFIX } } },
    ],
  };
}

async function aggregateUsage(
  context: KeystoneContext,
  where: Record<string, unknown>,
): Promise<{ count: number; inputTokens: number }> {
  const row = (await context.sudo().prisma.techAiCallLog.aggregate({
    where,
    _count: { _all: true },
    _sum: { inputTokens: true },
  })) as UsageRow;

  return {
    count: row._count._all,
    inputTokens: row._sum.inputTokens ?? 0,
  };
}

function retryAfterFromOldest(
  oldestCreatedAt: Date | null | undefined,
  windowMs: number,
): number {
  if (!oldestCreatedAt) return Math.ceil(windowMs / 1000);
  const elapsed = Date.now() - oldestCreatedAt.getTime();
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

async function oldestInWindow(
  context: KeystoneContext,
  where: Record<string, unknown>,
): Promise<Date | null> {
  const rows = await context.sudo().prisma.techAiCallLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { createdAt: true },
  });
  return rows[0]?.createdAt ?? null;
}

function quotaError(
  quota: ManagedGeminiQuota,
  label: string,
  kind: "rpm" | "tpm" | "rpd",
  retryAfterSec: number,
): AiRateLimitError {
  const wait = `Espera ${retryAfterSec} s y vuelve a intentar.`;
  if (kind === "rpm") {
    return new AiRateLimitError(
      `${quota.model} llegó a ${quota.rpm} solicitudes por minuto (${label}). ${wait}`,
      retryAfterSec,
    );
  }
  if (kind === "tpm") {
    return new AiRateLimitError(
      `${quota.model} superó ${quota.tpmInput.toLocaleString("es-MX")} tokens de entrada por minuto (${label}). ${wait}`,
      retryAfterSec,
    );
  }
  return new AiRateLimitError(
    `${quota.model} llegó a ${quota.rpd} solicitudes por día (${label}). ${wait}`,
    retryAfterSec,
  );
}

async function assertQuotaForScope(params: {
  context: KeystoneContext;
  quota: ManagedGeminiQuota;
  label: string;
  where: Record<string, unknown>;
  upcomingInputTokens: number;
}): Promise<void> {
  const minuteAgo = new Date(Date.now() - AI_RATE_LIMIT.windowMs);
  const dayAgo = new Date(Date.now() - AI_RATE_LIMIT.dayMs);
  const minuteWhere = {
    AND: [
      params.where,
      { createdAt: { gte: minuteAgo } },
      notRateLimitedWhere(),
    ],
  };
  const dayWhere = {
    AND: [
      params.where,
      { createdAt: { gte: dayAgo } },
      notRateLimitedWhere(),
    ],
  };

  const [minute, day] = await Promise.all([
    aggregateUsage(params.context, minuteWhere),
    aggregateUsage(params.context, dayWhere),
  ]);
  const oldest = await oldestInWindow(params.context, minuteWhere);
  const retryAfterSec = retryAfterFromOldest(oldest, AI_RATE_LIMIT.windowMs);

  if (minute.count >= params.quota.rpm) {
    throw quotaError(params.quota, params.label, "rpm", retryAfterSec);
  }
  if (minute.inputTokens + params.upcomingInputTokens > params.quota.tpmInput) {
    throw quotaError(params.quota, params.label, "tpm", retryAfterSec);
  }
  if (day.count >= params.quota.rpd) {
    throw quotaError(params.quota, params.label, "rpd", retryAfterSec);
  }
}

/**
 * Cupo de un modelo concreto (managed). Cuenta TechAiCallLog de ese model.
 */
export async function assertManagedModelQuota(params: {
  context: KeystoneContext;
  companyId: string;
  userId?: string | null;
  quota: ManagedGeminiQuota;
  upcomingInputTokens: number;
}): Promise<void> {
  const managedModel = {
    billingMode: AI_BILLING_MODE.MANAGED,
    ...(params.quota.model !== "default" ? { model: params.quota.model } : {}),
  };
  const upcoming = Math.max(0, params.upcomingInputTokens);

  const scopes = [
    ...(params.userId
      ? [
          {
            label: "tu usuario",
            where: { ...managedModel, userId: params.userId },
          },
        ]
      : []),
    {
      label: "tu empresa",
      where: { ...managedModel, companyId: params.companyId },
    },
    {
      label: "IA administrada de Kadesh",
      where: managedModel,
    },
  ];

  for (const scope of scopes) {
    await assertQuotaForScope({
      context: params.context,
      quota: params.quota,
      label: scope.label,
      where: scope.where,
      upcomingInputTokens: upcoming,
    });
  }
}

export async function selectManagedGeminiModel(params: {
  context: KeystoneContext;
  companyId: string;
  userId?: string | null;
  preferredModel?: string;
  upcomingInputTokens: number;
}): Promise<ManagedGeminiQuota> {
  const chain = getManagedGeminiChain(params.preferredModel);
  let lastError: AiRateLimitError | undefined;

  for (const quota of chain) {
    try {
      await assertManagedModelQuota({
        context: params.context,
        companyId: params.companyId,
        userId: params.userId,
        quota,
        upcomingInputTokens: params.upcomingInputTokens,
      });
      return quota;
    } catch (err) {
      if (err instanceof AiRateLimitError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw (
    lastError ??
    new AiRateLimitError(
      "Se agotó el cupo gratuito de todos los modelos de IA administrada. Prueba más tarde o usa tu propia API key.",
    )
  );
}

export function isManagedFallbackError(err: unknown): boolean {
  if (err instanceof AiRateLimitError) return true;
  if (!(err instanceof AiProviderError)) return false;
  if (
    err.status === 429 ||
    err.status === 404 ||
    err.status === 503 ||
    err.status === 500
  ) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("not found") ||
    msg.includes("unavailable")
  );
}

/**
 * Rate limit único (proveedor managed que no es Gemini).
 * Gemini managed usa selectManagedGeminiModel.
 */
export async function assertAiRateLimit(params: {
  context: KeystoneContext;
  companyId: string;
  userId?: string | null;
  billingMode: AiBillingMode;
  upcomingInputTokens: number;
  quota?: ManagedGeminiQuota;
}): Promise<void> {
  if (params.billingMode !== AI_BILLING_MODE.MANAGED) {
    return;
  }
  const quota = params.quota ?? {
    model: "default",
    rpm: 15,
    tpmInput: 250_000,
    rpd: 500,
  };
  await assertManagedModelQuota({
    context: params.context,
    companyId: params.companyId,
    userId: params.userId,
    quota,
    upcomingInputTokens: params.upcomingInputTokens,
  });
}
