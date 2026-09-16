# `utils/inegi`

Cliente HTTP de INEGI (fetch crudo, sin SDK) y mapeo al catálogo Keystone.

## Superficie

| Módulo                   | Qué                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `denue.ts`               | `Buscar` (`/condicion/lat,lng/metros/token`), `BuscarAreaAct`, `Ficha`. Token `INEGI_DENUE_TOKEN`. |
| `indicadores.ts`         | Banco de Indicadores BISE/BIE. Token `INEGI_INDICADORES_TOKEN`.                                    |
| `throttle.ts`            | ~400 ms entre requests + backoff 429/5xx.                                                          |
| `mapEstablishment.ts`    | API JSON y CSV (nombres de columna distintos) → mismo shape.                                       |
| `upsertEstablishment.ts` | Dedupe por `clee`; giro SCIAN perezoso.                                                            |
| `indicatorCatalog.ts`    | 4–8 IDs BISE de arranque (población, UE, PIB…).                                                    |

Dropdown de giros para el mapa (no es list SCIAN): [`utils/constants/inegiDenueCategories.ts`](../constants/inegiDenueCategories.ts).

Tokens: no se validan al boot de Keystone. Fallan en la mutación/script.

## Invariantes

- Radio DENUE máx. 5000 m. Página `BuscarAreaAct` máx. ~1000 filas.
- Si la API no trae código SCIAN, se agrupa con clave sintética `n:slug-del-nombre`.
- CSV e API no comparten nombres de campo; nunca asumir que `Nombre` = `Nom_Estab`.
- Cuerpo `No hay resultados` (texto, no JSON) = lista vacía, no error.
- Keyword del mapa = palabra del título SCIAN (`laboratorios`), no un fragmento con tilde (`diagnostico`).

## Decisiones

### 2026-09-14 — Fetch crudo + throttle propio

INEGI no documenta rate limit. Igual que Places: `fetch` + espera, no SDK.

### 2026-09-15 — Path Buscar: un segmento `lat,lng`

La docs oficiales usan `/Buscar/{condicion}/{lat},{lng}/{metros}/{token}`. Separar lat y lng en dos segmentos da HTTP 404 vacío. Keyword sin acentos (`médicos` → `medicos`); varias palabras van con coma.
