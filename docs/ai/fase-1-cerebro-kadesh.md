# Fase 1 — Cerebro Kadesh

## Backend (este repo)

Cubierto por Fase 0: no hay campos de contexto nuevos. `buildSystemPrompt(company)` concatena los 4 `onboarding*` y se inyecta en **todas** las llamadas de `callCompanyAi`.

Punto de entrada para el frontend:

```graphql
mutation UpdateCompanyAiSettings($input: UpdateCompanyAiSettingsInput!) {
  updateCompanyAiSettings(input: $input) {
    success
    message
    billingMode
    provider
    model
    apiKeyPreview
    keyUpdatedAt
  }
}

mutation TestCompanyAiConnection($companyId: ID!) {
  testCompanyAiConnection(companyId: $companyId) {
    success
    message
  }
}

# Campos públicos de settings (la key cifrada sale null por field access)
query CompanyAiSettings($id: ID!) {
  saasCompany(where: { id: $id }) {
    id
    aiBillingMode
    aiProvider
    aiModel
    aiApiKeyPreview
    aiKeyUpdatedAt
    onboardingMainOffer
    onboardingIdealCustomer
    onboardingAvgTicketValue
    onboardingSalesPain
  }
}

mutation RemainingCredits {
  remainingCredits {
    success
    message
    remainingQuota
    extraCredits
    leadLimit
    planLeadLimit
    year
    month
  }
}
```

## Frontend (`kadesh-business`, no este repo)

Pendiente de implementar cuando se aborde el cliente:

1. Tab `"ai"` en `PanelControlSection.tsx` — label "Cerebro IA", `requireAdminCompany: true`.
2. `src/components/profile/ai/AiSettingsSection.tsx`: selector BYOK vs administrado, proveedor, key tipo password (solo se envía si el usuario escribió algo), modelo opcional, "Probar conexión". En `managed`, el saldo es el mismo `remainingCredits` (no hay bolsa aparte de IA) + el flujo de compra de créditos que ya existe.
3. Copy en `ProfileCompanySection.tsx`: quitar "futura versión" y decir que ya alimenta la IA.
4. Vendedores no-admin no ven el tab de settings; sí usan la IA configurada (digest en Inicio, Fases 3–4).
