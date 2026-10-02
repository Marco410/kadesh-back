# Saas

Dominio B2B: company, planes, créditos, workspaces, cotizaciones y pagos.

El CRM y el catálogo INEGI/IA están en `Tech/` (leads, tareas, propuestas, `TechAiInsight`, DENUE). Siguen siendo lists `Tech*`; solo cambió la carpeta.

## Decisiones

### 2026-09-17 — Tech dentro de Saas

Qué: `models/Tech` se movió a `models/Saas/Tech`. El B2B (company, planes, CRM, INEGI) queda en un solo dominio.

Qué no hacer: no recrear `models/Tech` en la raíz.

### 2026-10-02 — Solicitudes de eliminación de Meta

Qué: `MetaDataDeletionRequest` guarda el callback de Data Deletion de la app de Meta. El HTTP vive en `webhooks/metaDataDeletion.ts`.

Qué no hacer: no tratar `whatsappAppId` ni el teléfono de un mensaje como el `user_id` de ese callback. Ver `docs/meta/data-deletion.md`.

## Qué no va aquí

Directorio de veterinarias, adopción o tienda (`Pet/`). Auth (`User`, `Role`).
