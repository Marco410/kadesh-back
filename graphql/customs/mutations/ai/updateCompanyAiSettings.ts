import { KeystoneContext } from "@keystone-6/core/types";
import {
  AI_BILLING_MODE,
  callCompanyAi,
  isAiBillingMode,
  isAiProviderKey,
  AiInsufficientCreditsError,
  AiNotConfiguredError,
  AiPlatformNotConfiguredError,
  AiProviderError,
  AiRateLimitError,
} from "../../../../utils/ai";
import { encrypt, maskApiKey } from "../../../../utils/helpers/encryption";
import { canManageCompanyAi, denyCompanyAiAccessMessage } from "./access";

const typeDefs = `
  input UpdateCompanyAiSettingsInput {
    companyId: ID!
    billingMode: String
    provider: String
    apiKey: String
    model: String
  }

  type UpdateCompanyAiSettingsResult {
    success: Boolean!
    message: String!
    billingMode: String
    provider: String
    model: String
    apiKeyPreview: String
    keyUpdatedAt: String
  }

  type TestCompanyAiConnectionResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    updateCompanyAiSettings(input: UpdateCompanyAiSettingsInput!): UpdateCompanyAiSettingsResult!
    testCompanyAiConnection(companyId: ID!): TestCompanyAiConnectionResult!
  }
`;

const definition = `
  updateCompanyAiSettings(input: UpdateCompanyAiSettingsInput!): UpdateCompanyAiSettingsResult!
  testCompanyAiConnection(companyId: ID!): TestCompanyAiConnectionResult!
`;

type UpdateCompanyAiSettingsInput = {
  companyId: string;
  billingMode?: string | null;
  provider?: string | null;
  apiKey?: string | null;
  model?: string | null;
};

type CompanyAiSettingsRecord = {
  id: string;
  aiBillingMode?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiApiKeyPreview?: string | null;
  aiKeyUpdatedAt?: string | null;
};

const SETTINGS_QUERY =
  "id aiBillingMode aiProvider aiModel aiApiKeyPreview aiKeyUpdatedAt";

function toResult(
  success: boolean,
  message: string,
  company?: CompanyAiSettingsRecord | null,
) {
  return {
    success,
    message,
    billingMode: company?.aiBillingMode ?? null,
    provider: company?.aiProvider ?? null,
    model: company?.aiModel ?? null,
    apiKeyPreview: company?.aiApiKeyPreview ?? null,
    keyUpdatedAt: company?.aiKeyUpdatedAt ?? null,
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
    return `El proveedor rechazó la prueba: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error al llamar a la IA";
}

const resolver = {
  updateCompanyAiSettings: async (
    _root: unknown,
    { input }: { input: UpdateCompanyAiSettingsInput },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyAi(session, input.companyId)) {
      return toResult(false, denyCompanyAiAccessMessage(session));
    }

    const existing = (await context.sudo().query.SaasCompany.findOne({
      where: { id: input.companyId },
      query: SETTINGS_QUERY,
    })) as CompanyAiSettingsRecord | null;

    if (!existing) {
      return toResult(false, "No se encontró la empresa");
    }

    const data: Record<string, unknown> = {};

    if (input.billingMode != null && input.billingMode !== "") {
      if (!isAiBillingMode(input.billingMode)) {
        return toResult(false, "Modalidad de pago de IA inválida", existing);
      }
      data.aiBillingMode = input.billingMode;
    }

    if (input.provider !== undefined) {
      if (input.provider === null || input.provider === "") {
        data.aiProvider = null;
      } else if (!isAiProviderKey(input.provider)) {
        return toResult(false, "Proveedor de IA inválido", existing);
      } else {
        data.aiProvider = input.provider;
      }
    }

    if (input.model !== undefined) {
      data.aiModel = input.model?.trim() ? input.model.trim() : null;
    }

    if (input.apiKey !== undefined && input.apiKey !== null) {
      if (input.apiKey === "") {
        data.aiApiKeyEncrypted = null;
        data.aiApiKeyPreview = null;
        data.aiKeyUpdatedAt = null;
      } else {
        try {
          data.aiApiKeyEncrypted = encrypt(input.apiKey.trim());
        } catch (err) {
          return toResult(
            false,
            err instanceof Error
              ? err.message
              : "No se pudo cifrar la API key. Revisa AI_ENCRYPTION_KEY.",
            existing,
          );
        }
        data.aiApiKeyPreview = maskApiKey(input.apiKey);
        data.aiKeyUpdatedAt = new Date().toISOString();
      }
    }

    const nextBillingMode =
      (data.aiBillingMode as string | undefined) ?? existing.aiBillingMode;
    const nextProvider =
      data.aiProvider !== undefined
        ? (data.aiProvider as string | null)
        : existing.aiProvider;
    const hasKeyAfterUpdate =
      input.apiKey === undefined || input.apiKey === null
        ? Boolean(existing.aiApiKeyPreview)
        : input.apiKey !== "";

    if (
      nextBillingMode !== AI_BILLING_MODE.MANAGED &&
      hasKeyAfterUpdate &&
      !nextProvider
    ) {
      return toResult(
        false,
        "Elige un proveedor (Claude, OpenAI o Gemini) antes de guardar la API key.",
        existing,
      );
    }

    if (Object.keys(data).length === 0) {
      return toResult(true, "No hay cambios que guardar", existing);
    }

    const updated = (await context.sudo().query.SaasCompany.updateOne({
      where: { id: input.companyId },
      data,
      query: SETTINGS_QUERY,
    })) as CompanyAiSettingsRecord;

    return toResult(true, "Configuración de IA guardada", updated);
  },

  testCompanyAiConnection: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyAi(session, companyId)) {
      return {
        success: false,
        message: denyCompanyAiAccessMessage(session),
      };
    }

    try {
      await callCompanyAi({
        context,
        companyId,
        featurePrompt:
          "Responde solo con la palabra PONG. No agregues puntuación ni explicación.",
        userPrompt: "PING",
        feature: "connection_test",
        bill: false,
        maxTokens: 16,
      });
      return {
        success: true,
        message: "Conexión OK con Kadesh AI",
      };
    } catch (err) {
      return {
        success: false,
        message: friendlyAiError(err),
      };
    }
  },
};

export default { typeDefs, definition, resolver };
