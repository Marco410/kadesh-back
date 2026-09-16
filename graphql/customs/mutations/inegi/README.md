# Mutaciones INEGI

Catálogo DENUE/BIE. Runtime: [`utils/inegi`](../../../../utils/inegi/README.md). Lists: [`models/Tech/Inegi`](../../../../models/Tech/Inegi/README.md).

Ejemplos copiables para el front: [docs/inegi/uso.md](../../../../docs/inegi/uso.md). Carga masiva (no GraphQL): `pnpm inegi:import:denue`, `inegi:import:indicadores`, `inegi:import:geo`.

Análisis de mercado (`generateMarketInsight` / `marketInsight`) no vive aquí: [`../../ai`](../../ai/README.md).

## Qué hace cada mutación

### `syncLeadsFromInegi`

Espejo de `syncLeadsFront` para DENUE. El usuario manda **lat, lng, radius (km), category** y se le asignan a su company los establecimientos cercanos.

1. Misma cuota que Google (suscripción, trial, `remainingQuota`). `maxResults` default 60, limitado por el cupo.
2. Leads `source = INEGI` ya en CRM en ese radio y categoría, que aún no están en la company → `connect` + Detectado + cobrar el lote.
3. Catálogo `TechInegiEstablishment` en una caja lat/lng + Haversine (más cercanos primero). Si faltan, API DENUE (`Buscar`, radio máx. **5 km**) y upsert al catálogo; esas filas se unen **por CLEE** (no se re-filtra el giro con `contains`). Sin token no falla si el catálogo ya cubre la zona.
4. Crea o conecta `TechBusinessLead` hasta `maxResults`. 1 crédito por lead **nuevo para esa company**. Log en `TechLeadSyncLog`.

No usa rating/reseñas (DENUE no las trae). `skippedLowRating` va en 0 para que el result shape coincida con Google.

`message` es copy de producto: nunca HTTP, JSON, token ni “DENUE”. “No hay resultados” de la API = lista vacía (`success: true`, “No encontramos negocios…”).

Dropdown de categoría: [`utils/constants/inegiDenueCategories.ts`](../../../../utils/constants/inegiDenueCategories.ts) (mismos `label` que Google; `value` = keyword DENUE). El backend también acepta values de Google (`negocios locales` → `todos`).

### `syncEstablishmentsFromInegi`

Pide a la API DENUE una zona y **upsert** en el catálogo compartido `TechInegiEstablishment` (dedupe por `clee`). No crea leads ni cobra créditos.

- Quién: sesión iniciada. Token `INEGI_DENUE_TOKEN`.
- Input: **lat + lng** (radio en metros, default 1000, máx. 5000, `keyword` opcional) **o** `stateCode` (más `municipalityCode` / `localityCode` / `scianCode` / `keyword`). Hay que mandar una de las dos formas.
- Tope: `maxResults` acotado a 250. Filas sin CLEE/nombre se omiten.
- Efecto: giros SCIAN perezosos en `TechInegiEconomicActivity`; siempre escribe `TechInegiSyncLog` (`sourceMethod: api`), éxito o error.
- Respuesta: `created`, `updated` (también en `alreadyInDb`), `totalFetched`, `message`.

### `promoteInegiEstablishmentToLead`

Pasa un establecimiento **ya en catálogo** al CRM de la empresa: `TechBusinessLead` con `source: "INEGI"` y `sourceEstablishment`.

- Quién: sesión + `resolveAuthorizedCompanyId`. `companyId` solo lo usa el admin de plataforma.
- Input: `establishmentId` (id Keystone, no el CLEE). `assignedSellerId` opcional (debe ser de la misma company); si no, primer vendedor verificado o el usuario.
- Cuota: igual que sync de leads. Sin suscripción / trial vencido / cupo 0 → `success: false`.
- Si ya existe un lead con ese establecimiento:
  - ya conectado a esa company → no cobra (`creditsCharged: 0`); asegura status `01 - Detectado`.
  - de otra company → `saasCompany.connect` + 1 crédito `CONSUME_SYNC`.
- Si no existe: crea el lead (nombre, teléfono, mail, dirección, ciudad/estado, `México`, web, lat/lng, categoría SCIAN), status Detectado, 1 crédito.
- No pega a INEGI: el establecimiento tiene que existir antes (sync o import CSV).

### `fetchInegiIndicator`

Consulta el Banco de Indicadores (BISE) y **cachea** en `TechInegiIndicator` (upsert por `cacheKey` = `indicatorId:geographicCode:period`). No cobra créditos de sync.

- Quién: sesión iniciada. Token `INEGI_INDICADORES_TOKEN`.
- Input: `indicatorId` (p. ej. `1002000001` población), `geographicCode` (`00` nacional, `09` estado, `09015` municipio), `recent` (default `true` = última observación).
- Respuesta: filas mapeadas (`period`, `value`, `unit`, nivel geo) más `created` / `updated`.
- IDs de arranque: [`utils/inegi/indicatorCatalog.ts`](../../../../utils/inegi/indicatorCatalog.ts). Cualquier id de INEGI vale; el catálogo solo pone nombre amigable.

## Invariantes

- Promover un lead ya conectado a esa company: `creditsCharged: 0`.
- Sync de catálogo escribe `TechInegiSyncLog` (éxito o error).
- Sin token en env: mensaje de usuario, no stack.

## Decisiones

### 2026-09-14 — Promover cobra como syncLeadsFront, no como import Google

`importBusinessLeadFromGoogle` no cobra. Asignar desde el pool DENUE es el caso “ya está en BD” de `syncLeadsFront`: 1 crédito.

### 2026-09-15 — Mapa INEGI = syncLeadsFromInegi

El front no hace loop de `promote`. Misma cuota y result shape que Google. Catálogo + Haversine en el radio del cliente; API DENUE solo si faltan filas y nunca más de 5 km. `source` del lead es `INEGI` (no `"INEGI DENUE"`).

### 2026-09-15 — Mensajes de mapa sin jerga INEGI

`syncLeadsFromInegi.message` es copy para el usuario. Fallos de API → “No pudimos completar la búsqueda…”. Cero filas → `success: true` y “No encontramos negocios…”. El detalle técnico queda en `console.error`.

### 2026-09-15 — API DENUE se une por CLEE

Tras upsert, no se vuelve a pedir el catálogo con `contains` del keyword. Ese filtro tiraba labs cuyo nombre no trae la palabra (p. ej. “Chopo”) o cuya clase tiene tilde (`diagnóstico` vs `diagnostico`).
