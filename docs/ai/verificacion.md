# Verificación — Fase 0/1

## Antes de probar

1. Aplicar `migrations/20260910194400_add_company_ai/migration.sql` (o `pnpm migrate` si tu `_prisma_migrations` está al día).
2. Tener `AI_ENCRYPTION_KEY` en `config/.env.dev` (64 hex). Ya hay un placeholder local; rota la key si este archivo se filtró.
3. Para modalidad `managed`: `PLATFORM_AI_PROVIDER` + `PLATFORM_AI_API_KEY`.
4. Reiniciar `pnpm dev`.

## Backend

- [ ] `yarn migrate` (o la migración `add_company_ai`) aplica limpio.
- [ ] Query genérica `saasCompany { aiApiKeyEncrypted }` regresa `null` / no deja leer el ciphertext.
- [ ] `updateCompanyAiSettings` como `admin_company` de la empresa guarda preview enmascarado y **no** regresa la key.
- [ ] `updateCompanyAiSettings` como vendedor de la misma empresa es rechazado.
- [ ] `updateCompanyAiSettings` con `apiKey: ""` limpia preview y timestamp.
- [ ] Omitir `apiKey` no borra la key existente.
- [ ] `testCompanyAiConnection` en BYOK con key real → `success: true`.
- [ ] `testCompanyAiConnection` sin key en BYOK → mensaje de "configura tu API key".
- [ ] `aiBillingMode: managed` + `PLATFORM_AI_API_KEY` configurada → ping funciona sin key de empresa y **no** descuenta créditos.
- [ ] Managed con 0 créditos → bloquea con un mensaje claro **antes** de llamar al proveedor.
- [ ] `remainingCredits` sigue devolviendo el cupo único (leads + IA managed).
- [ ] `purchaseCredits` sigue sumando a `purchasedBonusCredits` (misma bolsa).
- [ ] Una llamada managed con ~2k in + 400 out debita **4** créditos (`CONSUME_AI` en el ledger).
- [ ] BYOK no mueve el periodo de créditos.
- [ ] Tras `testCompanyAiConnection` (éxito o error) existe un `TechAiCallLog` con `feature: "connection_test"`, prompts y (si aplicó) `response` / tokens. No hay API keys en el log.
- [ ] Una llamada managed exitosa deja `creditsCharged` acorde a tokens y `billed: true`.

## Frontend Fase 1

- [ ] `admin_company` ve Kadesh AI, guarda key, prueba conexión, el preview sobrevive un refresh.
- [ ] Vendedor no ve el tab de settings.
- [ ] Copy de onboarding ya no dice "futura versión".

## Fase 2 — Digest diario

Backend:

- [ ] Aplicar `migrations/20260911160000_add_ai_insight/migration.sql`.
- [ ] `dailyDigest` sin insight de hoy → `insight: null`, `success: true`.
- [ ] `generateDailyDigest` crea `TechAiInsight` `kind: daily_digest` con 3 `actions`.
- [ ] Segunda llamada el mismo día sin `force` no cobra ni llama al proveedor (`cached: true`).
- [ ] `force: true` regenera y (en managed) cobra tokens.
- [ ] Vendedor de otra empresa es rechazado.
- [ ] `TechAiCallLog` con `feature: "daily_digest"`.

Frontend:

- [ ] Inicio muestra "Generar mi resumen del día" si Kadesh AI está live.
- [ ] Tras generar, se ven 3 pasos y se puede regenerar.
- [ ] Si la IA no está live, el CTA apunta a settings (admin) o pide al admin (vendedor).

