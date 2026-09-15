# Verificación INEGI

1. Humano: tokens en `config/.env.dev` y `yarn migrate`. Ver [uso.md](./uso.md).
2. `pnpm dev` levanta sin error de schema.
3. Playground `/api/graphql` — `syncEstablishmentsFromInegi` de un municipio chico (o lat/lng con radio 500).
4. `promoteInegiEstablishmentToLead` de uno de esos ids: lead `source = INEGI`, 1 movimiento `CONSUME_SYNC`. Segunda llamada a la misma company: `creditsCharged: 0`.
5. `syncLeadsFromInegi` con lat/lng/radio/categoría: mismos créditos que `syncLeadsFront`; leads `source = INEGI` conectados a la company.
6. CSV recortado: `pnpm inegi:import:denue -- --latin1 ./recorte.csv` dos veces; la segunda solo actualiza (`clee`).
7. `fetchInegiIndicator` con un id del catálogo y `geographicCode: "09"`.
8. `generateMarketInsight`: primer call cobra tokens IA; segundo en el mismo mes `creditsCharged: 0`. Revisar `TechAiCallLog`.
