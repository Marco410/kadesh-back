# TechStatusBusinessLead

Estatus de un lead en el pipeline de **una empresa**. Hay una sola fila por (lead, SaasCompany), y todo el equipo de esa empresa la comparte: si alguien mueve el lead, todos ven la nueva etapa.

- **Índice único** `("businessLead", "saasCompany")`, definido con `db.extendPrismaSchema`. El hook también rechaza una segunda fila, para que el error sea legible.
- **`salesPerson` está deprecado.** El vendedor asignado vive en `TechBusinessLead.salesPerson`, y el hook descarta `salesPerson` en cada escritura.
- **Acceso** (`statusLeadCompanyScopedWhere`): con `clientes.ver_empresa` se ve toda la empresa; sin ese permiso, solo los estatus de los leads asignados.
- **Crear desde el servidor:** usa `ensureLeadStatus` (`utils/helpers/tech/lead_assignment.ts`), que crea la fila solo si no existe y nunca toca una etapa existente.
- **Historial de etapas:** `recordStageChange` lo escribe en `TechLeadStageChange` en cada escritura, también las hechas con sudo.

Para pasar de una fila por vendedor a una por empresa existe `scripts/mergeLeadStatusPerCompany.ts` (`yarn leads:merge-status`). Decisión completa: `models/Saas/README.md`, entrada 2026-10-12.
