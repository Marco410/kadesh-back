import { DEFAULT_AI_MODELS } from "../constants";
import { AiProviderError } from "../errors";
import {
  toGuardedUserPrompt,
  withPromptInjectionGuard,
} from "../promptSafety";
import { estimateTokensFromText } from "../tokenCredits";
import type { AiCompletionParams, AiCompletionResult, AiProviderAdapter } from "../types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

async function complete(params: AiCompletionParams): Promise<AiCompletionResult> {
  const systemPrompt = withPromptInjectionGuard(params.systemPrompt);
  const userPrompt = toGuardedUserPrompt(params.userPrompt);

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new AiProviderError(
      payload?.error?.message ?? `Anthropic HTTP ${response.status}`,
    );
  }

  const text = payload?.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new AiProviderError("Anthropic no devolvió texto");
  }

  return {
    text,
    usage: {
      inputTokens:
        payload?.usage?.input_tokens ??
        estimateTokensFromText(systemPrompt + userPrompt),
      outputTokens:
        payload?.usage?.output_tokens ?? estimateTokensFromText(text),
    },
  };
}

export const anthropicAdapter: AiProviderAdapter = {
  key: "anthropic",
  defaultModel: DEFAULT_AI_MODELS.anthropic,
  complete,
};
