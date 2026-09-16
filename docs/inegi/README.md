# INEGI en Kadesh

Catálogo oficial de establecimientos (DENUE), indicadores (BIE) y límites (Marco Geoestadístico) para el CRM Tech y Cerebro Kadesh.

**Empieza aquí:** [Uso — CSV, import, GraphQL para el front](./uso.md).

No hay cron: sync puntual por GraphQL o scripts que corre un humano.

## Estado

| Fase | Qué | Estado |
| --- | --- | --- |
| **0** | Modelos, `utils/inegi`, env | Código listo — falta `yarn migrate` si no lo corriste |
| **1** | DENUE vivo + promover a lead + CSV masivo | Código listo |
| **2** | Indicadores BIE | Código listo |
| **3** | GeoJSON del MGN (sin PostGIS) | Código listo |
| **4** | `generateMarketInsight` | Código listo |

## Documentos

- [Uso (ops + front)](./uso.md) — tokens, bajar CSV, importar, “exportar”, queries y mutaciones
- [Fase 0 — Infraestructura](./fase-0-infraestructura.md)
- [Fase 1 — DENUE](./fase-1-denue.md)
- [Fase 2 — Indicadores](./fase-2-indicadores.md)
- [Fase 3 — Marco geoestadístico](./fase-3-marco-geoestadistico.md)
- [Fase 4 — Análisis IA](./fase-4-analisis-ia.md)
- [Decisiones](./decisiones.md)
- [Verificación](./verificacion.md)

Código operativo:

- [`models/Tech/Inegi`](../../models/Tech/Inegi/README.md)
- [`utils/inegi`](../../utils/inegi/README.md)
- [`graphql/customs/mutations/inegi`](../../graphql/customs/mutations/inegi/README.md)
