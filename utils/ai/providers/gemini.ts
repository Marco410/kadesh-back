import { DEFAULT_AI_MODELS } from "../constants";
import { AiProviderError } from "../errors";
import {
  toGuardedUserPrompt,
  withPromptInjectionGuard,
} from "../promptSafety";
import { estimateTokensFromText } from "../tokenCredits";
import type { AiCompletionParams, AiCompletionResult, AiProviderAdapter } from "../types";

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function complete(params: AiCompletionParams): Promise<AiCompletionResult> {
  const systemPrompt = withPromptInjectionGuard(params.systemPrompt);
  const userPrompt = toGuardedUserPrompt(params.userPrompt);

  const response = await fetch(geminiUrl(params.model), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: params.maxTokens ?? 1024,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new AiProviderError(
      payload?.error?.message ?? `Gemini HTTP ${response.status}`,
    );
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new AiProviderError("Gemini no devolvió texto");
  }

  return {
    text,
    usage: {
      inputTokens:
        payload?.usageMetadata?.promptTokenCount ??
        estimateTokensFromText(systemPrompt + userPrompt),
      outputTokens:
        payload?.usageMetadata?.candidatesTokenCount ??
        estimateTokensFromText(text),
    },
  };
}

export const geminiAdapter: AiProviderAdapter = {
  key: "gemini",
  defaultModel: DEFAULT_AI_MODELS.gemini,
  complete,
};
