# Fases 3–4 — Roadmap (aún no implementar)

La Fase 2 ya está en [fase-2-digest-diario.md](./fase-2-digest-diario.md). Arquitectura acordada para lo que sigue.

## Fase 3 — Dashboards narrativos

Reutiliza `TechAiInsight` (`MONTHLY_NARRATIVE`, `salesPerson: null`).

**Prerrequisito:** `TechStatusBusinessLead` no tiene fecha de cierre. Añadir `closedAt` seteado por hook cuando `pipelineStatus` pasa a `GANADO`/`DESCARTADO`.

Mutación `generateMonthlyNarrative`: agrega leads/tasa de cierre/tiempo medio **en servidor** y pide un texto (no charts nuevos).

Costo managed: tokens reales; una narrativa típica ~8 créditos.

## Fase 4 — Análisis de archivos

Enganche: `ArchivosSection` / `TechFile`. La ficha de lead aún no tiene archivos propios.

Extraer texto del PDF en servidor (`pdf-parse`) y mandarlo como texto a `callCompanyAi` (un solo flujo para los 3 proveedores).

Mutación `analyzeFileWithAi`: propone tareas, **no las crea**. El usuario confirma checkboxes y el CRUD de `TechTask` las mete en la columna default del workspace.

Costo managed: tokens reales (un PDF mediano ~16 créditos).
