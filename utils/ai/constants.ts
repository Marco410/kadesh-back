export const AI_BILLING_MODE = {
  BYOK: "byok",
  MANAGED: "managed",
} as const;

export type AiBillingMode =
  (typeof AI_BILLING_MODE)[keyof typeof AI_BILLING_MODE];

export const AI_BILLING_MODE_OPTIONS = [
  { label: "API key propia (BYOK)", value: AI_BILLING_MODE.BYOK },
  { label: "Administrado por Kadesh", value: AI_BILLING_MODE.MANAGED },
];

export const AI_PROVIDER = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  GEMINI: "gemini",
} as const;

export type AiProviderKey = (typeof AI_PROVIDER)[keyof typeof AI_PROVIDER];

export const AI_PROVIDER_OPTIONS = [
  { label: "Claude (Anthropic)", value: AI_PROVIDER.ANTHROPIC },
  { label: "OpenAI", value: AI_PROVIDER.OPENAI },
  { label: "Gemini (Google)", value: AI_PROVIDER.GEMINI },
];

export const DEFAULT_AI_MODELS: Record<AiProviderKey, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
};

export const AI_FEATURE = {
  CONNECTION_TEST: "connection_test",
  DAILY_DIGEST: "daily_digest",
  MONTHLY_NARRATIVE: "monthly_narrative",
  FILE_ANALYSIS: "file_analysis",
  PROFILE_PLAYBOOK: "profile_playbook",
} as const;

/**
 * Cupos Gemini 3.5 Flash Lite (tier gratuito / key de plataforma).
 * Solo modalidad managed. Por usuario, por empresa y a toda la plataforma.
 */
export const AI_RATE_LIMIT = {
  rpm: 15,
  tpmInput: 250_000,
  rpd: 500,
  windowMs: 60_000,
  dayMs: 24 * 60 * 60 * 1000,
} as const;

export const AI_RATE_LIMIT_ERROR_PREFIX = "AI_RATE_LIMIT";

export type AiFeature = (typeof AI_FEATURE)[keyof typeof AI_FEATURE];

