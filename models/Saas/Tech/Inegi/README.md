# Catálogo INEGI (DENUE / BIE / MGN)

Lists de referencia **compartidas** (no tenant). El tenant entra al promover un establecimiento a `TechBusinessLead`. Escrituras solo vía `sudo()` (mutaciones y scripts). Lectura del catálogo abierta.

## Lists

| List | Clave de dedupe |
| --- | --- |
| `TechInegiEstablishment` | `clee` |
| `TechInegiEconomicActivity` | `scianCode` |
| `TechInegiIndicator` | `cacheKey` = `indicatorId:geographicCode:period` |
| `TechInegiGeoBoundary` | `cacheKey` = `level:geoCode` |
| `TechInegiSyncLog` | log de corridas (`api` / `bulk_import`) |

`TechBusinessLead.sourceEstablishment` apunta al establecimiento DENUE. `LEAD_SOURCE.INEGI` = `"INEGI"`.

Cómo llenar y consultar el catálogo desde ops/front: [docs/inegi/uso.md](../../../../docs/inegi/uso.md).

## Invariantes

- Create/update/delete de catálogo = `false` en access. Un GraphQL anónimo no puede vaciar 6M filas.
- Sync de catálogo **no** cobra créditos. Promover a lead **sí** (1 crédito `CONSUME_SYNC`) si la company aún no lo tenía.
- Tras cambiar estos modelos: el humano corre `yarn migrate`. El agente no toca `migrations/`.

## Decisiones

### 2026-09-14 — Catálogo público, no generalAccess de escritura

`utils/generalAccess` deja create/delete abiertos (como PetPlace). A escala DENUE eso es peligroso. Query abierta; escrituras solo sudo.
