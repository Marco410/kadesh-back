# Fase 0 — Infraestructura compartida

Base que reutilizan las Fases 1–4. Se implementa junto con la Fase 1.

## 1. Cifrado de API keys

- Archivo: `utils/helpers/encryption.ts`
- AES-256-GCM (Node `crypto`, sin dependencias nuevas)
- Env: `AI_ENCRYPTION_KEY` — 32 bytes en hex (`openssl rand -hex 32`)
- Formato persistido: `ivHex:authTagHex:ciphertextHex`
- La key **nunca** viaja por GraphQL: solo `aiApiKeyPreview` (enmascarada)

## 2. Campos en `SaasCompany`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `aiBillingMode` | select `byok` \| `managed` | default `byok` |
| `aiProvider` | select `anthropic` \| `openai` \| `gemini` | nullable; aplica en BYOK |
| `aiModel` | text | override opcional; vacío = default del proveedor |
| `aiApiKeyEncrypted` | text | `read/create/update: false`; solo `context.sudo()` |
| `aiApiKeyPreview` | text | legible, no actualizable por API genérica |
| `aiKeyUpdatedAt` | timestamp | nullable |

El contexto de negocio **ya estaba**: `onboardingMainOffer`, `onboardingIdealCustomer`, `onboardingAvgTicketValue`, `onboardingSalesPain`.

No hay cupo ni paquetes aparte para IA: el crédito mensual del plan y las recargas (`SaasCredit`) son la misma bolsa. Ver [precio-tokens.md](./precio-tokens.md).

## 3. Capa de proveedores — `utils/ai/`

```
utils/ai/
  types.ts
  errors.ts
  constants.ts
  index.ts              # factory, buildSystemPrompt, callCompanyAi
  providers/
    anthropic.ts
    openai.ts
    gemini.ts
```

`callCompanyAi({ context, companyId, featurePrompt, userPrompt, creditCost? })`:

1. Carga la empresa con sudo.
2. Arma el mismo system prompt (Cerebro + instrucción de la feature) en ambas modalidades.
3. **BYOK:** descifra la key de la empresa y llama al adapter. Si falta config → `AiNotConfiguredError`.
4. **Managed:** usa `PLATFORM_AI_PROVIDER` + `PLATFORM_AI_API_KEY` (+ `PLATFORM_AI_MODEL` opcional). Estima créditos por tokens **antes** de llamar al proveedor (`AiInsufficientCreditsError` si no alcanzan). Si la llamada sale bien, debita `ceil((input + output×5) / 1000)` del periodo mensual común, ledger `CONSUME_AI`.
5. **BYOK:** no toca créditos.

## 4. Una bolsa de créditos

El periodo mensual existente (`companyId:year:month`) cubre leads **e** IA. El ledger distingue el gasto con `type: CONSUME_AI` vs `CONSUME_SYNC`. `purchaseCredits` no cambia.

Ver [precio-tokens.md](./precio-tokens.md) para la conversión tokens → créditos.

## 5. Historial de llamadas — `TechAiCallLog`

Cada `callCompanyAi` (éxito o error) persiste una fila:

- quién (`user`) y qué empresa
- `feature`, `billingMode`, `provider`, `model`
- `featurePrompt`, `systemPrompt`, `userPrompt`, `response`
- `inputTokens`, `outputTokens`, `billableTokens`, `creditsCharged`
- `billed`, `success`, `errorMessage`, `durationMs`

Altas solo vía `sudo()`. La empresa solo lee las suyas. No se guardan API keys.

## 6. Env vars nuevas (`config/.env.template`)

```
AI_ENCRYPTION_KEY=
PLATFORM_AI_PROVIDER=anthropic
PLATFORM_AI_API_KEY=
PLATFORM_AI_MODEL=
```

`PLATFORM_*` nunca se exponen al frontend.

## 7. Mutaciones custom — `graphql/customs/mutations/ai/`

| Mutación | Quién | Qué hace |
| --- | --- | --- |
| `updateCompanyAiSettings` | `admin_company` de esa empresa (o `admin`) | Guarda modalidad, proveedor, modelo y (si viene) cifra la key |
| `testCompanyAiConnection` | igual | Ping mínimo vía `callCompanyAi` |

Reglas de `apiKey` en update:

- `undefined` / omitido → no toca la key
- `""` → borra key, preview y `aiKeyUpdatedAt`
- texto → cifra, escribe preview enmascarado, actualiza timestamp

Nunca regresa ciphertext ni plaintext.
