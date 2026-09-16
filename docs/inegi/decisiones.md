# Decisiones INEGI

## 2026-09-14 — Catálogo separado + promover a lead

Igual que PetPlace: el DENUE no pertenece a un tenant. El CRM entra en `promoteInegiEstablishmentToLead`.

## 2026-09-14 — Escritura cerrada (no generalAccess)

PetPlace usa access abierto. A escala ~6M filas, create/delete públicos son un wipe. Query abierta; writes sudo.

## 2026-09-14 — Promover cobra 1 crédito

Alinear con `syncLeadsFront` (asignar desde BD), no con `importBusinessLeadFromGoogle`. Si el lead ya está en la company, 0 créditos.

## 2026-09-14 — Sin PostGIS ni paquete shapefile

Postgres alpine actual no trae PostGIS. Geo se guarda como GeoJSON; el humano convierte el shapefile.

## 2026-09-14 — Tokens no bloquean el boot

Como `GOOGLE_MAPS_API_KEY`: fallan en la mutación, no en `keystone.ts` (S3 sí mata el proceso).

## 2026-09-15 — DENUE Buscar: `lat,lng` juntos

`syncLeadsFromInegi` pegaba `/Buscar/médicos/19.43/-99.13/5000/token` y INEGI respondía 404. El path correcto es un par `lat,lng` y keyword ASCII.

## 2026-09-15 — Mensajes de mapa sin jerga INEGI

`message` de `syncLeadsFromInegi` nunca lleva HTTP/JSON/token. “No hay resultados” es lista vacía, no error.

## 2026-09-15 — Catálogo DENUE paralelo a Google Places

Mismos `label` que Google cuando existe el giro. `value` = palabra del título SCIAN México **2023** (Excel INEGI). El dropdown cubre clases frecuentes en DENUE, no las 1086. `resolveDenueSearch` sigue traduciendo values de Google.

## 2026-09-15 — Laboratorios = `laboratorios`, no `diagnostico`

SCIAN 621511 es “Laboratorios médicos y de diagnóstico”. DENUE y Postgres `contains` no matchean `diagnostico` (sin tilde) contra “diagnóstico”. El value es `laboratorios`; `diagnostico` queda como alias. Tras la API, el mapa une por CLEE y no vuelve a filtrar el giro.
