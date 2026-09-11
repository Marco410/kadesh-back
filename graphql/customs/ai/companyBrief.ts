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
  COMPANY_BRIEF_FEATURE_PROMPT,
  companyBriefSourceHash,
  companyBriefUserPrompt,
  fallbackCompanyBriefPillars,
  findCompanyBrief,
  parseCompanyBriefPillars,
  saveCompanyBrief,
  sourceHashFromStructuredData,
  toCompanyBriefPayload,
  type CompanyBriefInsightPayload,
  type CompanyBriefSource,
} from "../../../utils/ai/companyBrief";
import {
  canUseCompanyAi,
  denyCompanyAiUseMessage,
} from "../mutations/ai/access";

const typeDefs = `
  type CompanyAiBriefPillar {
    key: String!
    title: String!
    summary: String!
    gaps: [String!]!
  }

  type CompanyAiBriefInsight {
    id: ID!
    generatedAt: String
    sourceHash: String!
    pillars: [CompanyAiBriefPillar!]!
  }

  type CompanyAiBriefResult {
    success: Boolean!
    message: String!
    cached: Boolean!
    creditsCharged: Int
    insight: CompanyAiBriefInsight
  }
`;

const queryDefinition = `
  companyAiBrief(companyId: ID!): CompanyAiBriefResult!
`;

const mutationDefinition = `
  generateCompanyAiBrief(companyId: ID!, force: Boolean): CompanyAiBriefResult!
`;

type BriefResult = {
  success: boolean;
  message: string;
  cached: boolean;
  creditsCharged: number | null;
  insight: CompanyBriefInsightPayload | null;
};

function toResult(
  success: boolean,
  message: string,
  extras?: {
    cached?: boolean;
    creditsCharged?: number | null;
    insight?: CompanyBriefInsightPayload | null;
  },
): BriefResult {
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
    err instanceof AiPlatformNotConfiguredError ||
    err instanceof AiRateLimitError
  ) {
    return err.message;
  }
  if (err instanceof AiProviderError) {
    return `El proveedor rechazó la llamada: ${err.message}`;
  }
  return err instanceof Error
    ? err.message
    : "No se pudo actualizar lo que Kadesh AI sabe de tu negocio";
}

async function loadCompany(
  context: KeystoneContext,
  companyId: string,
): Promise<CompanyBriefSource | null> {
  return (await context.sudo().query.SaasCompany.findOne({
    where: { id: companyId },
    query:
      "id name onboardingMainOffer onboardingIdealCustomer onboardingAvgTicketValue onboardingSalesPain",
  })) as CompanyBriefSource | null;
}

const queryResolver = {
  companyAiBrief: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyAi(session, companyId)) {
      return toResult(false, denyCompanyAiUseMessage(session));
    }

    const company = (await loadCompany(context, companyId)) ?? {};
    const existing = await findCompanyBrief(context, companyId);
    if (!existing) {
      return toResult(true, "Aún no hay un resumen de tu negocio", {
        cached: false,
        insight: null,
      });
    }

    return toResult(true, "Lo que Kadesh AI sabe de tu empresa", {
      cached: true,
      insight: toCompanyBriefPayload(existing, company),
    });
  },
};

const mutationResolver = {
  generateCompanyAiBrief: async (
    _root: unknown,
    { companyId, force }: { companyId: string; force?: boolean | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyAi(session, companyId)) {
      return toResult(false, denyCompanyAiUseMessage(session));
    }

    const company = (await loadCompany(context, companyId)) ?? {};
    const sourceHash = companyBriefSourceHash(company);
    const existing = await findCompanyBrief(context, companyId);
    const existingHash = existing
      ? sourceHashFromStructuredData(existing.structuredData)
      : "";

    if (existing && !force) {
      return toResult(true, "Ya había un resumen de tu negocio.", {
        cached: true,
        creditsCharged: 0,
        insight: toCompanyBriefPayload(existing, company),
      });
    }

    if (existing && force && existingHash === sourceHash) {
      return toResult(true, "El perfil no cambió. Seguimos con el mismo resumen.", {
        cached: true,
        creditsCharged: 0,
        insight: toCompanyBriefPayload(existing, company),
      });
    }

    const hasAnyProfile = Boolean(
      company.onboardingMainOffer?.trim() ||
        company.onboardingIdealCustomer?.trim() ||
        company.onboardingAvgTicketValue?.trim() ||
        company.onboardingSalesPain?.trim(),
    );

    if (!hasAnyProfile) {
      const pillars = fallbackCompanyBriefPillars(company);
      const saved = await saveCompanyBrief(context, {
        companyId,
        pillars,
        sourceHash,
        existingId: existing?.id,
      });
      return toResult(true, "Completa los cuatro puntos para que Kadesh AI conozca tu negocio.", {
        cached: false,
        creditsCharged: 0,
        insight: toCompanyBriefPayload(saved, company),
      });
    }

    try {
      const result = await callCompanyAi({
        context,
        companyId,
        featurePrompt: COMPANY_BRIEF_FEATURE_PROMPT,
        userPrompt: companyBriefUserPrompt(company),
        feature: AI_FEATURE.COMPANY_BRIEF,
        bill: true,
        maxTokens: 900,
      });

      let pillars = parseCompanyBriefPillars(result.text, company);
      if (pillars.every((pillar) => !pillar.summary.trim())) {
        pillars = fallbackCompanyBriefPillars(company);
      }

      const saved = await saveCompanyBrief(context, {
        companyId,
        pillars,
        sourceHash,
        existingId: existing?.id,
      });

      return toResult(true, "Listo. Esto es lo que Kadesh AI ya sabe de tu negocio.", {
        cached: false,
        creditsCharged: result.creditsCharged,
        insight: toCompanyBriefPayload(saved, company),
      });
    } catch (err) {
      if (existing) {
        return toResult(false, friendlyAiError(err), {
          insight: toCompanyBriefPayload(existing, company),
        });
      }
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
