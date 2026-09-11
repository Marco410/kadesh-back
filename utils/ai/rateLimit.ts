import { KeystoneContext } from "@keystone-6/core/types";
import {
  AI_BILLING_MODE,
  AI_RATE_LIMIT,
  AI_RATE_LIMIT_ERROR_PREFIX,
  type AiBillingMode,
} from "./constants";
import { AiRateLimitError } from "./errors";

type UsageRow = {
  _count: { _all: number };
  _sum: { inputTokens: number | null };
};

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

type LimitScope = {
  label: string;
  where: Record<string, unknown>;
};

function checkAgainstLimits(params: {
  label: string;
  minute: { count: number; inputTokens: number };
  dayCount: number;
  upcomingInputTokens: number;
  retryAfterSec: number;
}): void {
  const { label, minute, dayCount, upcomingInputTokens, retryAfterSec } =
    params;
  const wait = `Espera ${retryAfterSec} s y vuelve a intentar.`;

  if (minute.count >= AI_RATE_LIMIT.rpm) {
    throw new AiRateLimitError(
      `Llegaste al máximo de ${AI_RATE_LIMIT.rpm} solicitudes por minuto (${label}). ${wait}`,
      retryAfterSec,
    );
  }

  if (minute.inputTokens + upcomingInputTokens > AI_RATE_LIMIT.tpmInput) {
    throw new AiRateLimitError(
      `Esta llamada supera el cupo de ${AI_RATE_LIMIT.tpmInput.toLocaleString("es-MX")} tokens de entrada por minuto (${label}). ${wait}`,
      retryAfterSec,
    );
  }

  if (dayCount >= AI_RATE_LIMIT.rpd) {
    throw new AiRateLimitError(
      `Llegaste al máximo de ${AI_RATE_LIMIT.rpd} solicitudes de IA por día (${label}). Prueba mañana o usa tu propia API key.`,
      retryAfterSec,
    );
  }
}

/**
 * Corta ráfagas solo en modalidad managed (key de plataforma / Gemini).
 * BYOK no se limita: el gasto es de la API key del cliente.
 */
export async function assertAiRateLimit(params: {
  context: KeystoneContext;
  companyId: string;
  userId?: string | null;
  billingMode: AiBillingMode;
  upcomingInputTokens: number;
}): Promise<void> {
  if (params.billingMode !== AI_BILLING_MODE.MANAGED) {
    return;
  }

  const now = Date.now();
  const minuteAgo = new Date(now - AI_RATE_LIMIT.windowMs);
  const dayAgo = new Date(now - AI_RATE_LIMIT.dayMs);
  const upcoming = Math.max(0, params.upcomingInputTokens);
  const managed = { billingMode: AI_BILLING_MODE.MANAGED };

  const scopes: LimitScope[] = [
    {
      label: "tu empresa",
      where: { ...managed, companyId: params.companyId },
    },
    {
      label: "IA administrada de Kadesh",
      where: managed,
    },
  ];

  if (params.userId) {
    scopes.unshift({
      label: "tu usuario",
      where: { ...managed, userId: params.userId },
    });
  }

  for (const scope of scopes) {
    const minuteWhere = {
      AND: [
        scope.where,
        { createdAt: { gte: minuteAgo } },
        notRateLimitedWhere(),
      ],
    };
    const dayWhere = {
      AND: [
        scope.where,
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

    checkAgainstLimits({
      label: scope.label,
      minute,
      dayCount: day.count,
      upcomingInputTokens: upcoming,
      retryAfterSec,
    });
  }
}
