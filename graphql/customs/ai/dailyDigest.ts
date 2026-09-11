import { KeystoneContext } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../../models/Role/constants";
import {
  AI_FEATURE,
  callCompanyAi,
  AiInsufficientCreditsError,
  AiNotConfiguredError,
  AiPlatformNotConfiguredError,
  AiProviderError,
} from "../../../utils/ai";
import {
  DAILY_DIGEST_FEATURE_PROMPT,
  findDailyDigestInsight,
  formatActionsAsContent,
  formatSnapshotPrompt,
  gatherDailyDigestSnapshot,
  parseDigestActions,
  saveDailyDigestInsight,
  toDigestInsightPayload,
  todayKey,
  type DigestAction,
  type DigestInsightPayload,
} from "../../../utils/ai/dailyDigest";
import {
  canUseCompanyAi,
  denyCompanyAiUseMessage,
  getSessionCompanyId,
} from "../mutations/ai/access";

const typeDefs = `
  type DailyDigestAction {
    title: String!
    detail: String!
  }

  type DailyDigestInsight {
    id: ID!
    referenceKey: String!
    content: String
    actions: [DailyDigestAction!]!
    generatedAt: String
  }

  type DailyDigestResult {
    success: Boolean!
    message: String!
    cached: Boolean!
    creditsCharged: Int
    insight: DailyDigestInsight
  }

  type Query {
    dailyDigest(companyId: ID!): DailyDigestResult!
  }

  type Mutation {
    generateDailyDigest(companyId: ID!, force: Boolean): DailyDigestResult!
  }
`;

const queryDefinition = `
  dailyDigest(companyId: ID!): DailyDigestResult!
`;

const mutationDefinition = `
  generateDailyDigest(companyId: ID!, force: Boolean): DailyDigestResult!
`;

function toResult(
  success: boolean,
  message: string,
  extras?: {
    cached?: boolean;
    creditsCharged?: number | null;
    insight?: DigestInsightPayload | null;
  },
) {
  return {
    success,
    message,
    cached: extras?.cached ?? false,
    creditsCharged: extras?.creditsCharged ?? null,
    insight: extras?.insight ?? null,
  };
}

function friendlyAiError(err: unknown): string {
  if (
    err instanceof AiNotConfiguredError ||
    err instanceof AiInsufficientCreditsError ||
    err instanceof AiPlatformNotConfiguredError
  ) {
    return err.message;
  }
  if (err instanceof AiProviderError) {
    return `El proveedor rechazó la llamada: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error al generar el resumen del día";
}

function resolveDigestSalesPersonId(
  session: { data?: { id?: string } } | null | undefined,
  companyId: string,
): string | null {
  if (hasRole(session, [Role.ADMIN])) return null;
  if (
    hasRole(session, [Role.ADMIN_COMPANY]) &&
    getSessionCompanyId(session) === companyId
  ) {
    return null;
  }
  return session?.data?.id ?? null;
}

function fallbackActions(snapshotPrompt: string): DigestAction[] {
  return [
    {
      title: "Revisa el pipeline de hoy",
      detail:
        "No pude estructurar 3 pasos automáticos. Abre clientes y cotizaciones y elige el contacto de mayor valor.",
    },
    {
      title: "Cierra seguimientos vencidos",
      detail:
        "Prioriza a quien ya esperaba respuesta. Un WhatsApp corto desbloquea más que un mensaje largo.",
    },
    {
      title: "Prospecta con tu oferta actual",
      detail: snapshotPrompt.includes("(ninguno)")
        ? "Si el tablero está vacío, extrae o asigna clientes alineados a tu cliente ideal."
        : "Elige un lead sin contacto o una cotización enviada y da el siguiente paso hoy.",
    },
  ];
}

const queryResolver = {
  dailyDigest: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyAi(session, companyId)) {
      return toResult(false, denyCompanyAiUseMessage(session));
    }

    const today = todayKey();
    const salesPersonId = resolveDigestSalesPersonId(session, companyId);
    const existing = await findDailyDigestInsight(context, {
      companyId,
      salesPersonId,
      today,
    });

    if (!existing) {
      return toResult(true, "Aún no hay resumen para hoy", {
        cached: false,
        insight: null,
      });
    }

    return toResult(true, "Resumen del día", {
      cached: true,
      insight: toDigestInsightPayload(existing),
    });
  },
};

const mutationResolver = {
  generateDailyDigest: async (
    _root: unknown,
    { companyId, force }: { companyId: string; force?: boolean | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyAi(session, companyId)) {
      return toResult(false, denyCompanyAiUseMessage(session));
    }

    const today = todayKey();
    const salesPersonId = resolveDigestSalesPersonId(session, companyId);
    const existing = await findDailyDigestInsight(context, {
      companyId,
      salesPersonId,
      today,
    });

    if (existing && !force) {
      return toResult(true, "Ya tenías el resumen de hoy. Pásalo a acción.", {
        cached: true,
        creditsCharged: 0,
        insight: toDigestInsightPayload(existing),
      });
    }

    try {
      const snapshot = await gatherDailyDigestSnapshot(context, {
        companyId,
        salesPersonId,
      });
      const userPrompt = formatSnapshotPrompt(snapshot);
      const result = await callCompanyAi({
        context,
        companyId,
        featurePrompt: DAILY_DIGEST_FEATURE_PROMPT,
        userPrompt,
        feature: AI_FEATURE.DAILY_DIGEST,
        bill: true,
        maxTokens: 800,
      });

      let actions = parseDigestActions(result.text);
      if (actions.length < 3) {
        const fallback = fallbackActions(userPrompt);
        actions = [...actions, ...fallback].slice(0, 3);
      }

      const saved = await saveDailyDigestInsight(context, {
        companyId,
        salesPersonId,
        today,
        content: formatActionsAsContent(actions),
        actions,
        existingId: existing?.id,
      });

      return toResult(true, "Listo. Estos son tus 3 siguientes pasos de hoy.", {
        cached: false,
        creditsCharged: result.creditsCharged,
        insight: toDigestInsightPayload(saved),
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
