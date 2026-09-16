# Fase 4 — Análisis de mercado (Cerebro)

Misma receta que el digest diario: snapshot corto → `callCompanyAi` → `TechAiInsight`.

- `kind`: `market_analysis`
- `referenceKey`: `estado:municipio:actividad:YYYY-MM` (zona `America/Mexico_City`)
- `generateMarketInsight` / query `marketInsight`
- Access: `canUseCompanyAi`
- Managed: misma fórmula de tokens → créditos. `force: true` regenera.

El snapshot cuenta una muestra DENUE (máx. 2000 filas, top 8 giros) más indicadores BIE ya cacheados. No manda el catálogo entero al prompt. No hay RAG.

Queries `marketInsight` / `generateMarketInsight` para el front: [uso.md](./uso.md).

