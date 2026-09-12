# `utils/ai` — Cerebro Kadesh

Capa de proveedores y `callCompanyAi`. Cada `SaasCompany` elige **BYOK** o **managed**. Producto y fases: [docs/ai](../../docs/ai/README.md).

## Archivos

| Archivo | Rol |
| --- | --- |
| `index.ts` | `callCompanyAi`, `buildSystemPrompt`, factory de adapters |
| `constants.ts` | providers, defaults, `MANAGED_GEMINI_FALLBACK`, ventanas de rate limit |
| `rateLimit.ts` | cupos managed (por modelo en Gemini) y cadena de fallback |
| `providers/` | fetch crudo a Anthropic / OpenAI / Gemini (sin SDKs) |
| `tokenCredits.ts` | tokens → créditos (solo managed) |
| `promptSafety.ts` | system policy + `<untrusted_data>` |
| `callLog.ts` | `TechAiCallLog` (nunca lanza) |
| `dailyDigest.ts` / `playbook.ts` | snapshot, caché `TechAiInsight`, prompts de feature |

## Invariantes

- **BYOK:** key cifrada de la empresa; no rate limit de plataforma; no débitos de créditos.
- **Managed:** `PLATFORM_AI_PROVIDER` + `PLATFORM_AI_API_KEY` (+ `PLATFORM_AI_MODEL` opcional). Nunca la key del tenant. Misma bolsa de créditos del periodo (`CONSUME_AI`). Ping (`bill: false`) no cobra.
- **1 crédito = 1,000 tokens equivalentes** (`input + output×5`). Estimar *antes* de llamar; debitar *después* si hay usage.
- Rate limit **solo managed**. Los logs con `errorMessage` que empieza `AI_RATE_LIMIT` no cuentan contra el cupo.
- Onboarding de la empresa y el user prompt son **datos**. Van envueltos; el modelo solo obedece el system prompt.
- `userPrompt` en el log es el texto crudo del caller; `systemPrompt` ya lleva la guarda.

### Managed + Gemini: fallback de cupo gratis

Google limita **por modelo** (RPM / TPM de entrada / RPD). Si uno se agota, `callCompanyAi` recorre `MANAGED_GEMINI_FALLBACK` (el modelo preferido al frente si está en la lista).

1. Si el cupo local de ese modelo está lleno → siguiente, sin pegarle a Google.
2. Si Gemini responde 429 / 404 / 503 / 500 o mensaje de quota / not found → siguiente.
3. BYOK Gemini no encadena. Anthropic/OpenAI managed usan un cupo único (15/250K/500), no la cadena.

Default Gemini: `gemini-3.5-flash-lite` (el mayor cupo del nivel gratuito en la consola de Google).

Cadena actual (actualizar `MANAGED_GEMINI_FALLBACK` si cambia el dashboard de Google):

| Modelo | RPM | TPM in | RPD |
| --- | ---: | ---: | ---: |
| `gemini-3.5-flash-lite` | 15 | 250K | 500 |
| `gemini-3.1-flash-lite` | 15 | 250K | 500 |
| `gemini-2.5-flash-lite` | 10 | 250K | 20 |
| `gemini-2.5-flash` … `gemini-3.8-flash` | 5 | 250K | 20 |

Fuera de la cadena: embeddings, TTS, Live, Veo, Gemma, modelos en 0/0.

El log de éxito guarda **el modelo que sí respondió**. Los saltos intermedios no se persisten (para no inflar RPM).

## Env

```
AI_ENCRYPTION_KEY=          # 32 bytes hex
PLATFORM_AI_PROVIDER=gemini # anthropic | openai | gemini
PLATFORM_AI_API_KEY=
PLATFORM_AI_MODEL=          # opcional; vacío = default / primer eslabón de la cadena Gemini
```

## Decisiones

### 2026-09-10 — Una bolsa de créditos; fetch sin SDKs

Leads e IA managed pagan el mismo periodo. Distinción solo en el ledger. Adapters con `fetch`, igual que Places.

### 2026-09-10 — Ping no cobra

`testCompanyAiConnection` → `callCompanyAi({ bill: false })`.

### 2026-09-11 — Prompt injection

Policy al inicio del system prompt; onboarding y user prompt como `<untrusted_data>`.

### 2026-09-11 — Rate limit solo `managed`

Cuenta `TechAiCallLog`. Tres scopes: usuario, empresa, todas las llamadas managed. BYOK no aplica.

### 2026-09-11 — Fallback Gemini por modelo (nivel gratuito)

El cupo de Google es por modelo, no global. Cadena en `constants.ts`; chequeo por `billingMode + model` en `rateLimit.ts`; loop en `callCompanyAi`. Si todos fallan → `AiRateLimitError`.
