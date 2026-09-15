# Fase 2 — Indicadores / BIE

`fetchInegiIndicator(indicatorId, geographicCode, recent)` cachea en `TechInegiIndicator`. Ejemplos: [uso.md](./uso.md).

Geografía: `00` nacional, 2 dígitos estado, 5 dígitos municipio.

IDs de arranque en `utils/inegi/indicatorCatalog.ts` (población, unidades económicas, PIB…). Verificar en el sitio de INEGI si los retiran.

Precarga estatal (humano):

```
pnpm inegi:import:indicadores
pnpm inegi:import:indicadores -- 09
```
