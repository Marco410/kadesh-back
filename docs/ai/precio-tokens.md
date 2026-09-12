# Precio de tokens de IA en créditos Kadesh

Una sola bolsa: el crédito del plan / recarga extra sirve para **sync de leads** y para **IA administrada**. No hay paquetes ni periodos separados. BYOK no consume créditos.

## Fórmula

```
tokens equivalentes = inputTokens + outputTokens × 5
créditos = ceil(equivalentes / 1_000)
```

Constantes en `utils/ai/tokenCredits.ts`:

| Constante                    | Valor | Por qué                                                                                                                                     |
| ---------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `OUTPUT_TOKEN_WEIGHT`        |     5 | Precio lista Claude Sonnet 4.5: output $15 / input $3                                                                                       |
| `BILLABLE_TOKENS_PER_CREDIT` | 1,000 | El plan **regala** créditos cada mes; 4,000 eq/crédito daba ~50 digests en Free. Con 1,000, Free ≈ 12 digests y Starter ≈ un digest al día. |

## Ancla de producto (no de recarga)

El pack 1,000 créditos = 999 MXN sigue valiendo ~1 MXN/crédito, pero el precio de IA no se calibra ahí: se calibra a **cuánta IA debe rendir el cupo de regalo**.

| Plan    | Créditos/mes de regalo |       Digests típicos (4 cr. c/u) |
| ------- | ---------------------: | --------------------------------: |
| Free    |                     50 |                               ~12 |
| Starter |                    150 | ~37 (un digest al día y algo más) |
| Pro     |                    500 |                              ~125 |
| Agencia |                  2,000 |                              ~500 |

Un digest típico (2k in + 400 out) cuesta ~$0.012 de API Sonnet y **4 créditos** de Kadesh.

## Qué rinde N créditos

| Uso típico          | Tokens (in / out) | Equivalentes |          Créditos |
| ------------------- | ----------------- | -----------: | ----------------: |
| Digest diario corto | 2,000 / 400       |        4,000 |                 4 |
| Narrativa mensual   | 4,000 / 800       |        8,000 |                 8 |
| PDF mediano         | 12,000 / 800      |       16,000 |                16 |
| Ping de conexión    | —                 |            — | 0 (`bill: false`) |

## Cobro en runtime (solo `aiBillingMode = managed`)

1. **Antes:** estima créditos con chars/4 + `maxTokens`. Si no hay saldo, no llama al proveedor.
2. **Después:** usa `usage` real del proveedor (Anthropic `input_tokens`/`output_tokens`, OpenAI `prompt_tokens`/`completion_tokens`, Gemini `usageMetadata`). Debita `ceil(...)` del **mismo** periodo mensual, ledger `CONSUME_AI`.

## Cómo ajustar

Si el allowance mensual o el uso real se mueven, cambia `BILLABLE_TOKENS_PER_CREDIT` (menos tokens por crédito = más caro para el usuario). No hace falta migración.
