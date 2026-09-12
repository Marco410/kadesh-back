# Progreso

## 2026-09-10 — Fase 0 + backend de Fase 1

Se bajó el plan a código en `kadesh-back` y se dejó la documentación en `docs/ai/`.

### Hecho

- Cifrado AES-256-GCM (`utils/helpers/encryption.ts`) y env `AI_ENCRYPTION_KEY` / `PLATFORM_AI_*`.
- Campos de IA en `SaasCompany` (modalidad, proveedor, modelo, key cifrada, preview).
- Capa `utils/ai/` con adapters Anthropic / OpenAI / Gemini (fetch crudo) y `callCompanyAi`.
- Mutaciones `updateCompanyAiSettings` y `testCompanyAiConnection`.
- Créditos: una sola bolsa (plan + recargas). IA managed cobra por tokens (`utils/ai/tokenCredits.ts`). Ledger `CONSUME_AI`.
- Esquemas GraphQL/Prisma regenerados.
- Migración SQL: `migrations/20260910194400_add_company_ai/migration.sql`.

### Pendiente (no se tocó la DB local)

Aplicar la migración en tu Postgres cuando quieras:

```bash
# Si tu historial de Prisma está alineado:
pnpm migrate

# Si el local se mantiene con db push / schema ya existente, aplica solo el SQL nuevo:
# (desde el contenedor de postgres o un cliente SQL)
# migrations/20260910194400_add_company_ai/migration.sql
```

Luego rellenar `PLATFORM_AI_API_KEY` en `config/.env.dev` si vas a probar modalidad administrada.

### 2026-09-10 (tarde) — Una bolsa + precio por tokens

Se quitó `kind` de paquetes/periodos. Los mismos créditos cubren leads e IA. Fórmula: `ceil((input + output×5) / 1000)` créditos. Detalle en [precio-tokens.md](./precio-tokens.md).

### 2026-09-10 (noche) — Historial de llamadas

`TechAiCallLog` guarda cada `callCompanyAi`: usuario, prompts, respuesta, tokens, créditos, éxito/error. Migración: `migrations/20260910225500_add_ai_call_log/migration.sql`.

### 2026-09-10 — Precio 1,000 eq/crédito

`BILLABLE_TOKENS_PER_CREDIT` pasa de 4,000 a 1,000. Un digest típico cobra 4 créditos.

### 2026-09-11 — Fase 2 digest diario

- Modelo `TechAiInsight` (kinds `daily_digest` | `monthly_narrative` | `file_analysis`) y migración `migrations/20260911160000_add_ai_insight/migration.sql`.
- Query `dailyDigest` + mutación `generateDailyDigest(companyId, force)`. Caché por día (`YYYY-MM-DD`, zona México). Admin = insight de empresa; vendedor = personal.
- Snapshot: cotizaciones `sent`, leads sin contacto, seguimientos vencidos, leads fríos. La IA devuelve 3 `{title, detail}`.
- Frontend: tarjeta en Inicio (`DailyDigestCard`) — generar / ver / regenerar.

### Siguiente

1. Aplicar las migraciones de IA (settings, call log, insight) si aún no están en Postgres.
2. Fases 3–4 (narrativa mensual, análisis de archivos).

