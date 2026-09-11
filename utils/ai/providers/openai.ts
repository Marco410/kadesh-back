import { DEFAULT_AI_MODELS } from "../constants";
import { AiProviderError } from "../errors";
import { estimateTokensFromText } from "../tokenCredits";
import type { AiCompletionParams, AiCompletionResult, AiProviderAdapter } from "../types";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

async function complete(params: AiCompletionParams): Promise<AiCompletionResult> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new AiProviderError(
      payload?.error?.message ?? `OpenAI HTTP ${response.status}`,
    );
  }

  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiProviderError("OpenAI no devolvió texto");
  }

  return {
    text,
    usage: {
      inputTokens:
        payload?.usage?.prompt_tokens ??
        estimateTokensFromText(params.systemPrompt + params.userPrompt),
      outputTokens:
        payload?.usage?.completion_tokens ?? estimateTokensFromText(text),
    },
  };
}

export const openaiAdapter: AiProviderAdapter = {
  key: "openai",
  defaultModel: DEFAULT_AI_MODELS.openai,
  complete,
};
