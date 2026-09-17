# Fase 2 — Digest diario (siguientes pasos)

Sin cron. El vendedor abre **Inicio** y pulsa **Generar mi resumen del día**. La generación es perezosa y queda cacheada por día (`referenceKey: YYYY-MM-DD`, zona `America/Mexico_City`). Regenerar exige `force: true`.

## Modelo

`TechAiInsight` (`models/Saas/Tech/AiInsight/TechAiInsight.ts`):

- `company`, `salesPerson` (nullable; `null` = insight de empresa para admin / alcance global)
- `kind`: `daily_digest` | `monthly_narrative` | `file_analysis`
- `referenceKey`, `content`, `structuredData` (JSON `{ actions: [{ title, detail }] }`)
- `relatedFile` (para Fase 4), `generatedAt`
- create/update solo vía `sudo()` desde mutaciones de IA

Migración: `migrations/20260911160000_add_ai_insight/migration.sql`.

## Snapshot que se manda al modelo

`utils/ai/dailyDigest.ts` cruza, con el alcance del usuario:

1. Cotizaciones `sent` sin respuesta
2. Leads en Detectado / Seleccionado (sin primer contacto)
3. Seguimientos vencidos (Pendiente o Pospuesto, fecha &lt; hoy)
4. Leads fríos (`Sin Respuesta` o con primer contacto ≥ 14 días y pipeline abierto)

Máximo 8 filas por cubeta para mantener el digest en ~4 créditos managed.

## GraphQL

```graphql
query DailyDigest($companyId: ID!) {
  dailyDigest(companyId: $companyId) {
    success
    message
    cached
    insight {
      id
      referenceKey
      content
      generatedAt
      actions { title detail }
    }
  }
}

mutation GenerateDailyDigest($companyId: ID!, $force: Boolean) {
  generateDailyDigest(companyId: $companyId, force: $force) {
    success
    message
    cached
    creditsCharged
    insight {
      id
      referenceKey
      generatedAt
      actions { title detail }
    }
  }
}
```

- Cualquier miembro de la empresa (o admin de plataforma) puede **usar** la IA; solo `admin_company` configura settings.
- Admin de empresa → digest de empresa (`salesPerson: null`). Vendedor → digest personal.
- Cached hit no llama al proveedor ni cobra créditos.
- Feature log: `daily_digest`. BYOK no consume créditos; managed cobra tokens reales (un digest corto suele ser 4 créditos).
