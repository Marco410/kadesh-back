import { KeystoneContext } from "@keystone-6/core/types";
import {
  AI_FEATURE,
  callCompanyAi,
  AiInsufficientCreditsError,
  AiNotConfiguredError,
  AiPlatformNotConfiguredError,
  AiProviderError,
  AiRateLimitError,
} from "../../../utils/ai";
import {
  findMarketInsight,
  formatMarketSnapshotPrompt,
  gatherMarketSnapshot,
  MARKET_ANALYSIS_FEATURE_PROMPT,
  marketMonthKey,
  marketReferenceKey,
  parseMarketInsight,
  saveMarketInsight,
} from "../../../utils/ai/marketSnapshot";
import {
  canUseCompanyAi,
  denyCompanyAiUseMessage,
} from "../mutations/ai/access";

const typeDefs = `
  type MarketInsightAction {
    title: String!
    detail: String!
  }

  type MarketInsight {
    id: ID!
    referenceKey: String!
    content: String
    generatedAt: String
    summary: String
    actions: [MarketInsightAction!]!
  }

  type MarketInsightResult {
    success: Boolean!
    message: String!
    cached: Boolean!
    creditsCharged: Int
    insight: MarketInsight
  }
`;

const queryDefinition = `
  marketInsight(companyId: ID!, state: String, municipality: String, activity: String, geographicCode: String): MarketInsightResult!
`;

const mutationDefinition = `
  generateMarketInsight(companyId: ID!, state: String, municipality: String, activity: String, geographicCode: String, force: Boolean): MarketInsightResult!
`;

type InsightRecord = {
  id: string;
  referenceKey?: string | null;
  content?: string | null;
  structuredData?: unknown;
  generatedAt?: string | null;
};

type MarketInsightPayload = {
  id: string;
  referenceKey: string;
  content: string | null;
  generatedAt: string | null;
  summary: string;
  actions: Array<{ title: string; detail: string }>;
};

type Result = {
  success: boolean;
  message: string;
  cached: boolean;
  creditsCharged: number | null;
  insight: MarketInsightPayload | null;
};

function toResult(
  success: boolean,
  message: string,
  extras?: Partial<Result>,
): Result {
  return {
    success,
    message,
    cached: extras?.cached ?? false,
    creditsCharged: extras?.creditsCharged ?? null,
    insight: extras?.insight ?? null,
  };
}

function structuredFromRecord(record: InsightRecord): {
  summary: string;
  actions: Array<{ title: string; detail: string }>;
} {
  const data = record.structuredData as
    | { summary?: string; actions?: Array<{ title?: string; detail?: string }> }
    | null;
  const actions = (data?.actions ?? [])
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      detail: String(item.detail ?? "").trim(),
    }))
    .filter((item) => item.title && item.detail);
  return {
    summary: data?.summary?.trim() || record.content?.trim() || "",
    actions,
  };
}

function toPayload(record: InsightRecord): MarketInsightPayload {
  const parsed = structuredFromRecord(record);
  return {
    id: record.id,
    referenceKey: record.referenceKey ?? "",
    content: record.content ?? null,
    generatedAt: record.generatedAt ?? null,
    summary: parsed.summary,
    actions: parsed.actions,
  };
}

function friendlyAiError(err: unknown): string {
  if (
    err instanceof AiNotConfiguredError ||
    err instanceof AiInsufficientCreditsError ||
    err instanceof AiPlatformNotConfiguredError ||
    err instanceof AiRateLimitError
  ) {
    return err.message;
  }
  if (err instanceof AiProviderError) {
    return `El proveedor rechazó la llamada: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error al generar el análisis de mercado";
}

type Args = {
  companyId: string;
  state?: string | null;
  municipality?: string | null;
  activity?: string | null;
  geographicCode?: string | null;
  force?: boolean | null;
};

const queryResolver = {
  marketInsight: async (
    _root: unknown,
    args: Args,
    context: KeystoneContext,
  ) => {
    if (!canUseCompanyAi(context.session, args.companyId)) {
      return toResult(false, denyCompanyAiUseMessage(context.session));
    }
    const referenceKey = marketReferenceKey(args, marketMonthKey());
    const existing = await findMarketInsight(context, args.companyId, referenceKey);
    if (!existing) {
      return toResult(true, "Aún no hay análisis de mercado para esta zona este mes", {
        cached: false,
        insight: null,
      });
    }
    return toResult(true, "Análisis de mercado cacheado", {
      cached: true,
      creditsCharged: 0,
      insight: toPayload(existing as InsightRecord),
    });
  },
};

const mutationResolver = {
  generateMarketInsight: async (
    _root: unknown,
    args: Args,
    context: KeystoneContext,
  ) => {
    if (!canUseCompanyAi(context.session, args.companyId)) {
      return toResult(false, denyCompanyAiUseMessage(context.session));
    }

    const referenceKey = marketReferenceKey(args, marketMonthKey());
    const existing = (await findMarketInsight(
      context,
      args.companyId,
      referenceKey,
    )) as InsightRecord | null;

    if (existing && !args.force) {
      return toResult(true, "Ya tenías este análisis de mercado. Regenera con force.", {
        cached: true,
        creditsCharged: 0,
        insight: toPayload(existing),
      });
    }

    try {
      const snapshot = await gatherMarketSnapshot(context, args);
      const userPrompt = formatMarketSnapshotPrompt(snapshot);
      const result = await callCompanyAi({
        context,
        companyId: args.companyId,
        featurePrompt: MARKET_ANALYSIS_FEATURE_PROMPT,
        userPrompt,
        feature: AI_FEATURE.MARKET_ANALYSIS,
        bill: true,
        maxTokens: 800,
      });

      const parsed = parseMarketInsight(result.text);
      const content =
        parsed.summary +
        (parsed.actions.length
          ? "\n" +
            parsed.actions
              .map((action, index) => `${index + 1}. ${action.title} — ${action.detail}`)
              .join("\n")
          : "");

      const saved = (await saveMarketInsight(context, {
        companyId: args.companyId,
        referenceKey,
        content,
        structuredData: parsed,
        existingId: existing?.id,
      })) as InsightRecord;

      return toResult(true, "Análisis de mercado listo", {
        cached: false,
        creditsCharged: result.creditsCharged,
        insight: toPayload(saved),
      });
    } catch (err) {
      return toResult(false, friendlyAiError(err));
    }
  },
};

export default {
  typeDefs,
  queryDefinition,
  mutationDefinition,
  queryResolver,
  mutationResolver,
};
