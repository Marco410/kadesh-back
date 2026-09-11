import { KeystoneContext } from "@keystone-6/core/types";
import { toBillableTokens, type TokenUsage } from "./tokenCredits";

export type PersistAiCallLogParams = {
  context: KeystoneContext;
  companyId?: string | null;
  userId?: string | null;
  feature?: string | null;
  billingMode?: string | null;
  provider?: string | null;
  model?: string | null;
  featurePrompt?: string | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
  response?: string | null;
  usage?: TokenUsage | null;
  creditsCharged?: number;
  billed?: boolean;
  success: boolean;
  errorMessage?: string | null;
  durationMs?: number | null;
};

/**
 * Persiste una llamada a IA. Nunca lanza: un fallo de log no debe tumbar la feature.
 */
export async function persistAiCallLog(
  params: PersistAiCallLogParams,
): Promise<void> {
  if (!params.companyId) return;

  const usage = params.usage ?? { inputTokens: 0, outputTokens: 0 };

  try {
    await params.context.sudo().query.TechAiCallLog.createOne({
      data: {
        company: { connect: { id: params.companyId } },
        ...(params.userId && { user: { connect: { id: params.userId } } }),
        feature: params.feature ?? null,
        billingMode: params.billingMode ?? null,
        provider: params.provider ?? null,
        model: params.model ?? null,
        featurePrompt: params.featurePrompt ?? null,
        systemPrompt: params.systemPrompt ?? null,
        userPrompt: params.userPrompt ?? null,
        response: params.response ?? null,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        billableTokens: toBillableTokens(usage),
        creditsCharged: params.creditsCharged ?? 0,
        billed: params.billed ?? false,
        success: params.success,
        errorMessage: params.errorMessage ?? null,
        durationMs: params.durationMs ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to persist TechAiCallLog:", err);
  }
}
