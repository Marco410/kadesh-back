# Decisiones — Operaciones

Registro de lo que se cambió para Operaciones y por qué. El detalle de cada query vive en [`graphql/customs/queries/admin/README.md`](../../graphql/customs/queries/admin/README.md).

## 2026-10-10 — Fase 0: los clientes ya no escriben su propia facturación

**Qué:** por API, solo el admin de plataforma crea, edita o borra:

| List | Antes | Ahora |
| --- | --- | --- |
| `SaasCredit` (paquetes de recarga) | create/update/delete abiertos **a cualquiera, sin sesión** | Solo admin. La lectura sigue pública (página de precios) |
| `SaasCompanySubscription` | Cualquier miembro editaba o borraba la suscripción de su empresa | Solo admin |
| `SaasCompanyCreditLedger`, `SaasCompanyCreditPeriod`, `SaasCompanyMonthlyLeadSync` | Cualquier miembro creaba, editaba o borraba | Solo admin |
| `SaasPayment` | El usuario creaba, editaba o borraba sus cobros | Solo admin (la lectura de los propios sigue igual) |
| `SaasReferralCommission` | Referidor, referido o empresa editaban | Solo admin |
| `TechLeadSyncLog`, `SaasSubscriptionLog` | Los miembros borraban los de su empresa | Solo admin borra |

**Por qué:** con el acceso anterior un cliente podía:
- cambiar `planFeatures` o `planLeadLimit` de su suscripción y desbloquear módulos o créditos sin pagar;
- inflar su saldo o borrar su gasto;
- borrar el rastro de sus extracciones;
- y, sin sesión, abaratar un paquete de créditos: `purchaseCredits` cobra con el `cost` y `creditsToAdd` guardados en `SaasCredit`.

Ninguna auditoría sirve si el auditado puede editar el registro.

**Por qué no rompe nada:** todo lo que escribe estas listas en el servidor usa `context.sudo()`:
- `utils/saas/companyCredits.ts`
- `createCompanySubscription`, `purchaseCredits`, `subscriptionStatus`, `updatePlanFeatureCatalog`
- el hook de alta de `SaasCompany`

El front de clientes no escribe ninguna de ellas. La única excepción, `createSaasPaymentMethod` (guardar tarjeta), no se tocó.

**Qué no hacer:** no reabrir `update`/`delete` para miembros de empresa. Si el panel del cliente necesita cambiar algo de su plan, va por una mutación custom que valide el cambio.

## 2026-10-10 — Fase 0: importadores de Google solo para admin

**Qué:** `syncBusinessLeadsFromGoogle` y `executeImportPetPlace` exigen `isPlatformAdmin`.

**Por qué:** no revisaban sesión. Cualquiera podía llamarlas por GraphQL y gastar la API de Google Maps o crear registros. Solo las usan las páginas del Admin de Keystone (`admin/pages/import-*.tsx`), que ya son de admin.

## 2026-10-10 — Fase 0: checkout y recargas exigen la sesión del pagador

**Qué:** `createCompanySubscription` y `purchaseCredits` rechazan la llamada (paso `SESSION_MISMATCH` en `SaasSubscriptionLog`) si la sesión no es del correo que viene en el input. El admin de plataforma sí puede.

**Por qué:** buscaban al usuario solo por `input.email`, así que se podía operar a nombre de otra cuenta. Los dos frontends mandan el correo del usuario con sesión, así que el flujo normal no cambia.

**Qué no hacer:** no volver a resolver al pagador solo por el correo del input.

## 2026-10-10 — Fase 0: las recargas de créditos vuelven a quedar en el log

**Qué:** `purchaseCredits` ya no manda el id del paquete como `planId` a `writeSaasSubscriptionLog`. Ahora va en `planIdRequested` y en `responseSnapshot.creditPackageId`.

**Por qué:** el writer conectaba ese id a `SaasPlan`. Como no existe un plan con ese id, el `createOne` fallaba y el error se tragaba: ninguna compra de créditos quedaba registrada.

## 2026-10-10 — Fase 0: fuera llamadas de depuración en `syncLeadsFront`

**Qué:** se quitaron los `fetch('http://127.0.0.1:7352/ingest/…')` y los marcadores `#region agent log`. Los `console.log` se quedan como log del servidor.

**Por qué:** eran restos de una sesión de depuración: en producción mandaban peticiones a un puerto local en cada extracción.

## 2026-10-10 — Fase 1: el login con contraseña se registra en el servidor

**Qué:** `passwordLoginAuditResolvers` envuelve el `authenticateUserWithPassword` de `@keystone-6/auth`:
- escribe `UserAuthLog` (`CUSTOM_AUTH_LOGIN` o `CUSTOM_AUTH_FAIL`, con `method: "password"` en el snapshot);
- en el éxito, marca `User.lastLoginAt`;
- los intentos fallidos se ligan a la cuenta si el correo existe.

Además, `UserAuthLog.create` por API queda solo para admin, y el front deja de llamar `createUserAuthLog` y `updateUser({ lastLoginAt })`.

**Por qué:** el login con contraseña es el más usado y el backend no lo registraba. Lo escribía el navegador con un `create` abierto incluso a anónimos, así que el historial de accesos y el "último acceso" de Operaciones se podían falsificar. Los logins de Pet (kadesh-landing) no quedaban en ningún lado; ahora sí.

**Qué no hacer:** no volver a escribir accesos desde el cliente. No guardar contraseña ni token en el log.

## 2026-10-10 — Fase 1: el admin lee cotizaciones y proyectos de cualquier empresa

**Qué:** `SaasQuotation`, `SaasProject` y `SaasQuotationProduct` tienen rama de admin de plataforma en `filter.query`. La escritura no cambia.

**Por qué:** eran las únicas lists del CRM sin esa rama. El admin veía vacías las cotizaciones de cualquier empresa que no fuera la suya, y el 360 no podía mostrarlas.

## 2026-10-10 — Fase 1: agregados de Operaciones en el back

**Qué:** cuatro queries custom solo para admin: `adminCompanies`, `adminOpsSummary`, `adminCompanyInsights` y `adminActivityFeed`.

**Por qué:**
- el estado vigente por empresa (la suscripción más reciente) no se puede filtrar bien con `subscriptions.some`;
- los conteos por persona y el feed que mezcla varios logs obligaban a bajar miles de filas al navegador.

Con Prisma `groupBy` y `aggregate` se resuelve en el servidor.

**Qué no hacer:** no devolver prompts de IA, cuerpos de WhatsApp ni datos sensibles en estas queries. Las conversaciones de IA se piden aparte, una por una.

## Pendiente (Fase 2)

- `ActivityEvent`: eventos propios con actor, empresa, entidad, metadata, IP y user-agent. Cubre lo que hoy no deja rastro: CRUD del CRM, cambios de pipeline, exportaciones, roles, correos y acciones del admin.
- Registrar qué empresas abre el admin (`admin.viewed_company`).
- Webhook de Stripe para renovaciones, fallos de cobro y cancelaciones.
