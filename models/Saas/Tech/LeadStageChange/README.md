# TechLeadStageChange — historial de etapas

Una fila cada vez que un lead cambia de etapa en el pipeline de una empresa, también cuando entra por primera vez (`fromStatus` vacío). `TechStatusBusinessLead` solo guarda la etapa actual; sin este historial no se puede medir cuánto dura cada etapa, cuántos avanzan ni el ciclo de venta.

## Quién la escribe

El hook `recordStageChange` (`models/Saas/Tech/StatusBusinessLead/recordStageChange.ts`), en el `afterOperation` de `TechStatusBusinessLead`. Corre en **toda** escritura, también las del servidor con `sudo` (extracciones crean en Detectado, una propuesta aceptada mueve a Cerrado Ganado), a diferencia del registro de actividad que solo anota lo que hacen personas.

- `source`: `web` (había sesión), `system` (servidor) o `backfill` (recuperado).
- `changedBy`: la persona de la sesión, si hay.
- Nunca rompe la operación: si no se pudo guardar, el cambio de etapa sigue.

## Historia anterior

`pnpm pipeline:backfill` (reporte) y `pnpm pipeline:backfill --apply` copian los eventos `lead.status_changed` de `ActivityEvent` (existen desde la fase 2). Lo anterior a eso no existe en ningún lado. Se puede correr varias veces: un cambio que ya está (mismo estatus y etapa con menos de un minuto de diferencia) no se repite.

## Acceso

Solo lo lee el admin de plataforma (Operaciones → Analítica → Ventas y la tarjeta del 360). Nadie escribe por API.

## Decisiones

### 2026-10-12 — Tabla propia y no solo `ActivityEvent`

`ActivityEvent` ya anotaba los cambios de etapa, pero solo los que hace una persona (no los automáticos), se borra a los 13 meses y guarda las etapas dentro de un JSON. Para medir velocidad hacía falta todo cambio, para siempre y fácil de consultar.
