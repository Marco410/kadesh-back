# Decisiones de implementación

Registro de decisiones tomadas al bajar el plan a código. Actualizar este archivo cada vez que el código se desvíe del plan original.

## 2026-09-10 — Una sola bolsa de créditos (corrige el plan original)

El plan original proponía `kind: leads | ai` y paquetes de IA. **No:** los mismos créditos (plan + recargas `SaasCredit`) pagan sync de leads e IA managed. El gasto de IA se distingue solo en el ledger (`CONSUME_AI`) y se cobra por **tokens**, no por tipo de feature.

Fórmula y anclas: [precio-tokens.md](./precio-tokens.md). **1 crédito = 1,000 tokens equivalentes** (`input + output×5`). Un digest típico = 4 créditos, para que el cupo de regalo del plan no se sienta ilimitado en IA.

Se revirtieron: `SaasCredit.kind`, periodos/ledger `kind`, `purchasedBonusAiCredits`, `monthlyAiCredits`, `planAiCreditLimit`.

## 2026-09-10 — 1,000 tokens equivalentes por crédito

4,000 eq/crédito hacía el cupo de regalo del plan demasiado barato en IA (Free ≈ 50 digests). Se bajó a **1,000** para que Free rinda ~12 digests y Starter cubra un digest al día. Ver [precio-tokens.md](./precio-tokens.md).

## 2026-09-10 — Arranque Fase 0/1

### `billingMode` entra en `updateCompanyAiSettings`

El plan listaba `{ companyId, provider, apiKey?, model? }`. El frontend de Fase 1 necesita persistir BYOK vs administrado en el mismo save.

**Decisión:** el input incluye `billingMode` opcional (`byok` | `managed`).

### Ping de conexión no cobra créditos

`testCompanyAiConnection` llama `callCompanyAi({ bill: false })`. En BYOK el gasto es del usuario; en managed el ping es tan chico que no vale 1 crédito.

### Modelos default (septiembre 2026)

Si `aiModel` / `PLATFORM_AI_MODEL` está vacío:

| Proveedor | Modelo |
| --- | --- |
| Anthropic | `claude-sonnet-4-5` |
| OpenAI | `gpt-4o` |
| Gemini | `gemini-2.5-flash` |

### Fetch crudo, cero SDKs

Igual que Google Places (`utils/helpers/nearby_petplaces.ts`). Evita tres dependencias y deja la interfaz `AiProviderAdapter` estable si más adelante se migra un proveedor al SDK oficial.

### `Role.ADMIN` de plataforma puede configurar IA de cualquier empresa

`hasRole` ya otorga todo a `admin`. El chequeo `session.company.id === companyId` se salta solo para ese rol; `admin_company` sigue limitado a su tenant.

### Historial de llamadas a IA

Toda llamada (incluido ping y errores de saldo/proveedor) se guarda en `TechAiCallLog`. El persist no tira si falla el insert, para no romper la feature.

## 2026-09-11 — Digest diario: alcance admin vs vendedor

El plan decía “el vendedor abre Inicio”. En el dashboard, `admin_company` ve el pipeline de toda la empresa.

**Decisión:** el digest de un admin de empresa (o admin de plataforma) se guarda con `salesPerson: null` (insight de empresa). El de un vendedor, con su usuario. Misma mutación, distinta clave de caché.

Cualquier miembro de la empresa puede **generar** el digest; solo `admin_company` configura la API key / modalidad.

