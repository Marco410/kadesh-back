import type { AiProviderKey } from "./constants";
import type { TokenUsage } from "./tokenCredits";

export type { AiProviderKey };

export type AiCompletionParams = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export type AiCompletionResult = {
  text: string;
  usage: TokenUsage;
};

export type AiProviderAdapter = {
  key: AiProviderKey;
  defaultModel: string;
  complete: (params: AiCompletionParams) => Promise<AiCompletionResult>;
};
