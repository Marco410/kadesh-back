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

### 2026-10-10 — Facturación y créditos solo los escribe el servidor

Qué: `SaasCredit`, `SaasCompanySubscription`, el ledger y los periodos de créditos, `SaasCompanyMonthlyLeadSync`, `SaasPayment` y `SaasReferralCommission`: por API solo el admin de plataforma crea, edita o borra. `TechLeadSyncLog` y `SaasSubscriptionLog` solo los borra el admin. `SaasQuotation`, `SaasProject` y `SaasQuotationProduct` tienen rama de lectura para admin.

Por qué: un cliente podía editar su suscripción (`planFeatures`, `planLeadLimit`), inflar sus créditos o borrar sus logs, y cualquiera sin sesión podía cambiar el precio de un paquete de créditos. Todo lo que escribe estas listas en el servidor ya usa `context.sudo()`.

Qué no hacer: no reabrir `update`/`delete` a miembros de empresa. Detalle en `docs/operaciones/decisiones.md`.

### 2026-10-10 — El hook de tenant de leads aceptaba `disconnect: []` como desligar

Qué: `TechBusinessLead.hooks.ts` permite que un usuario de empresa haga `connect` de un lead que ya existe a su propia empresa. La condición pedía `disconnect == null`, pero en un update Keystone siempre entrega `disconnect: []`. Resultado: para todo usuario que no fuera admin de plataforma, el `connect` se quitaba en silencio.

Por qué importa:
- Las syncs creaban el status y cobraban leads que nunca quedaban en la empresa.
- INEGI no lo verificaba; Google sí, así que ahí esos leads solo se perdían sin cobro.
- No se notaba probando como admin, porque el admin se salta el hook.

Ahora `disconnect: []` cuenta como sin cambios y la asignación pasa por `utils/helpers/tech/lead_assignment.ts`, que liga, verifica y luego crea el status. Los leads que ya habían quedado sin ligar se reparan con `pnpm leads:repair-unlinked` (`--apply`).

Para qué existe la reutilización: asignar leads que ya están en la base (de cualquier empresa) evita volver a pagar llamadas a Google Maps (Nearby Search / Place Details) y a la API DENUE de INEGI. Las syncs consultan primero la base y solo llaman a la API por lo que falta. Con el bug, para usuarios que no eran admin, Google se volvía a consultar por negocios que ya estaban guardados.

Qué no hacer: no comparar relaciones resueltas de Keystone con `== null`; un arreglo vacío es "sin cambios". No quitar el paso "primero la base": es el ahorro de API.

## Qué no va aquí

Directorio de veterinarias, adopción o tienda (`Pet/`). Auth (`User`, `Role`).
