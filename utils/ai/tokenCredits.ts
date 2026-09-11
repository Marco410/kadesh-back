/**
 * Conversión tokens de IA → créditos Kadesh (modalidad managed).
 *
 * Una sola bolsa: el mismo crédito sirve para sync de leads y para IA.
 * BYOK no consume créditos (la empresa paga al proveedor).
 *
 * Ancla de producto: el plan regala créditos cada mes (Free 50, Starter 150…).
 * Esos créditos también pagan IA managed, así que 4,000 eq/crédito era demasiado
 * barato (Free ≈ 50 digests). Se ancla a ~12 digests en Free / un digest al día
 * en Starter:
 *
 * 1 crédito = 1,000 tokens equivalentes
 *   equivalentes = inputTokens + outputTokens * 5
 *
 * Un digest típico (2k in + 400 out) = 4,000 eq = 4 créditos.
 * Markup vs lista Sonnet ≈ 18–20×; el cuello es el cupo de regalo, no el API.
 *
 * Ajustar BILLABLE_TOKENS_PER_CREDIT si cambia el allowance mensual o el uso real.
 */
export const OUTPUT_TOKEN_WEIGHT = 5;
export const BILLABLE_TOKENS_PER_CREDIT = 1_000;
export const CHARS_PER_TOKEN_ESTIMATE = 4;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export function toBillableTokens(usage: TokenUsage): number {
  const input = Math.max(0, usage.inputTokens);
  const output = Math.max(0, usage.outputTokens);
  return input + output * OUTPUT_TOKEN_WEIGHT;
}

/**
 * Créditos a debitar por una llamada. Siempre redondea hacia arriba.
 * 0 tokens → 0 créditos (p. ej. no se pudo leer usage y no hay texto).
 */
export function tokensToCredits(usage: TokenUsage): number {
  const billable = toBillableTokens(usage);
  if (billable <= 0) return 0;
  return Math.ceil(billable / BILLABLE_TOKENS_PER_CREDIT);
}

/** Estimación previa (chars/4) para no arrancar una llamada sin saldo. */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE));
}

export function estimateCreditsForPrompt(params: {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}): number {
  const inputTokens =
    estimateTokensFromText(params.systemPrompt) +
    estimateTokensFromText(params.userPrompt);
  const outputTokens = params.maxOutputTokens ?? 1024;
  return tokensToCredits({ inputTokens, outputTokens });
}
