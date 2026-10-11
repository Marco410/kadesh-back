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

## 2026-10-10 — Fase 2: registro de actividad propio (`ActivityEvent`)

**Qué:** list nueva `ActivityEvent` (quién, qué, sobre qué empresa e item, antes → después, origen, IP, navegador). Se escribe solo desde el servidor con `logActivity`, que nunca lanza y limpia la metadata. Tres caminos: hooks de lists (cambios hechos por personas), llamadas explícitas en mutaciones custom y `trackEvents` para lo que solo sabe el navegador. Detalle en [`models/ActivityEvent/README.md`](../../models/ActivityEvent/README.md).

**Por qué:** no existía ningún registro de quién mueve un lead, cambia roles, ajusta un plan o qué abre el admin de Kadesh. Sin eso no hay auditoría ni datos de uso para operar o vender analítica.

**Cambio frente al plan:** el plan copiaba todo el historial a esta tabla (backfill) y dejaba una sola fuente para el feed. Se dejó como complemento: los logs que ya existían siguen siendo la fuente de sus hechos y el feed une ambas fuentes. Evita duplicar datos que ya tienen tabla y autor, no hay backfill que mantener y el feed funciona igual antes y después de migrar.

**Qué no hacer:** no guardar aquí contraseñas, tokens, prompts, cuerpos de mensajes ni teléfonos de contactos. No registrar altas que ya tienen su tabla.

## 2026-10-10 — Fase 2: los hooks solo registran lo que hacen personas

**Qué:** `withActivityHooks` (en `models/schema.ts`) agrega un `afterOperation` a 15 lists (CRM, equipo, empresa, suscripción, planes y paquetes de créditos). Ignora las escrituras con `context.sudo()`.

**Por qué:** una extracción liga cientos de leads con sudo; registrar cada una sería ruido que `TechLeadSyncLog` ya resume. Lo que el servidor hace a nombre de alguien se registra con un evento explícito. Los cambios de roles y miembros de espacios toman una foto antes del update, porque el item que entrega Keystone no trae relaciones to-many.

**Qué no hacer:** no esperar (`await`) el registro dentro del hook ni dejar que lance: un error en `afterOperation` hace fallar la mutación aunque ya se guardó.

## 2026-10-10 — Fase 2: tiempo activo por día (`UserActivityDay`)

**Qué:** el front manda un latido cada 5 minutos con la pestaña visible. El servidor suma 5 minutos en la fila de esa persona y ese día (hora de CDMX). Un latido antes de 4 minutos solo actualiza "visto por última vez".

**Por qué:** la sesión dura 30 días, así que el último login no dice si alguien usa el panel; Operaciones marcaba como inactivos a equipos activos. Una fila por día (en vez de un evento por latido) mantiene la tabla chica y da directo usuarios activos, minutos de uso y "visto por última vez".

## 2026-10-10 — Fase 2: registro de lo que abre el admin de Kadesh

**Qué:** el 360 de una empresa, la ficha de una persona y cada conversación de IA que abre el admin quedan como `admin.viewed_company`, `admin.viewed_person` y `admin.viewed_ai_prompt` (tipo "Kadesh" en Actividad). Abrir lo mismo varias veces en 10 minutos cuenta una vez.

**Por qué:** se decidió que el admin ve todo el CRM del cliente con registro de accesos. Las conversaciones de IA pueden traer datos del negocio del cliente.

## 2026-10-10 — Fase 2: webhook de Stripe

**Qué:** `POST /webhooks/stripe`, con firma obligatoria (`STRIPE_WEBHOOK_SECRET`):
- `invoice.paid` (no el primer cobro, que ya registra el checkout) → `SaasPayment`, nuevo fin de periodo, `billing.renewed`; si estaba con pago vencido vuelve a activa;
- `invoice.payment_failed` → `SaasPayment` fallido y `billing.payment_failed`;
- `customer.subscription.updated` / `.deleted` → estado local, comisiones pendientes canceladas si dejó de pagar, `billing.status_changed` / `billing.cancelled`;
- `charge.refunded` → el cobro queda `refunded` y `billing.refunded`.

**Por qué:** sin webhook no había renovaciones, fallos de cobro ni cancelaciones; el estado solo se corregía cuando el cliente abría el panel. Los créditos no dependen de la renovación (se reparten por mes calendario mientras haya suscripción activa), así que el webhook no los toca.

**Cómo es seguro repetirlo:** Stripe reintenta y a veces duplica eventos. Cada handler revisa el estado antes de escribir (el cobro ya existe, el estado ya es el mismo). Lee los dos formatos de la API: antes y después de 2025-03 ("basil"), donde se movieron `invoice.subscription`, `invoice.charge` y `current_period_end`.

**Configuración en Stripe (producción):** destino `kadesh-back`, URL `https://kadesh-back-production.up.railway.app/webhooks/stripe` (sin `/api/v1`: los webhooks de kadesh-back cuelgan de la raíz, igual que `/webhooks/whatsapp`), los 5 eventos de arriba, estilo de datos *snapshot* (el handler necesita el objeto completo) y versión de API `2025-05-28.basil`.

**Reembolsos con `basil`:** en esa versión el cargo ya no trae `invoice`, y los cobros de suscripción quedan guardados con el id de la factura (Stripe también quitó `invoice.charge` e `invoice.payment_intent`). Si `charge.refunded` no encuentra el cobro por cargo o PaymentIntent, pregunta a Stripe a qué factura pertenece el PaymentIntent (`invoicePayments.list`) y busca por esa factura.

**Qué no hacer:** no procesar eventos sin firma válida. No mover créditos desde el webhook. No crear el destino en Stripe antes de que el back con este código esté desplegado: Stripe mandaría eventos reales a una ruta que no existe, reintentaría, enviaría correos de error y puede terminar desactivando el destino.

## 2026-10-10 — Fase 2: un error de Stripe ya no cancela suscripciones

**Qué:** `getStripeSubscription` distingue "no existe" (404, se trata como cancelada, igual que antes) de "no se pudo saber" (sin llave, 401, 429, 5xx, red). En el segundo caso `subscriptionStatus` confía en el estado local y no escribe nada. La lógica de sincronizar quedó en `utils/saas/stripeSubscriptionSync.ts`, compartida con el webhook, y ahora también guarda el nuevo fin de periodo cuando cambia (antes solo cuando cambiaba el estado).

**Por qué:** antes cualquier falla al consultar Stripe se leía como `status: null` → "cancelada". Una caída de Stripe, un 429 o una llave mal configurada cancelaba localmente la suscripción del cliente que abría el panel, y como la query solo busca suscripciones activas, no había forma de que se corrigiera sola.

**Qué no hacer:** no volver a mapear "sin respuesta" a cancelada.

## 2026-10-10 — Fase 2: créditos agotados y señales de compra

**Qué:** `credits.exhausted` cuando un consumo deja el mes en 0 (solo en esa transición, no en cada intento bloqueado). Desde el front: módulos bloqueados que ven (`ui.feature_locked_viewed`) y clics en mejorar plan (`ui.upgrade_clicked`). El 360 los muestra en "Cómo usan el panel".

**Por qué:** son las señales más directas de venta adicional: se quedan sin créditos o chocan con un módulo que no tienen.

## 2026-10-10 — Fase 2: IP y navegador en accesos y eventos

**Qué:** `UserAuthLog` y `ActivityEvent` guardan IP (`x-forwarded-for` del proxy si existe) y navegador.

**Por qué:** permiten detectar cuentas compartidas y accesos raros. Son datos personales: hay que mencionarlos en el Aviso de privacidad. Los eventos se borran a los 13 meses (`pnpm activity:prune`).

**Ojo:** sin proxy delante, el cliente puede mandar su propio `x-forwarded-for`. La IP es un dato informativo, no una prueba.

## 2026-10-11 — Fase 3: la prueba gratuita respeta su fecha de fin y se puede extender

**Qué:** `getFreePlanTrialInfo` usa `currentPeriodEnd` de la suscripción cuando existe (si no, alta + 7 días). Nueva mutación `adminExtendTrial(companyId, days | until)`: suma días al fin actual (o a hoy si ya venció) o fija una fecha; si la prueba estaba vencida, la suscripción vuelve a `trialing`. Solo aplica al plan gratuito (sin cobro en Stripe). Queda `admin.trial_extended` en Actividad.

**Por qué:** el fin de la prueba se recalculaba siempre desde la fecha de alta. La suscripción de prueba ya nace con su fin en `currentPeriodEnd`, pero se ignoraba, así que "Ajustar plan" no podía extender una prueba y el cliente seguía bloqueado.

**Qué no hacer:** no extender pruebas de planes de pago (eso es Stripe); no volver a calcular el fin solo desde la fecha de alta.

## 2026-10-11 — Fase 3: dueño de cuenta y notas internas

**Qué:** `SaasCompany.accountManager` (persona de Kadesh responsable de la cuenta; solo la asigna `adminSetCompanyAccountManager` y solo a alguien con rol admin) y `SaasCompanyNote` (notas internas; autor puesto por el servidor). En Operaciones: selector en la ficha del 360, sección **Notas** y filtro **Mis cuentas** en la lista de empresas.

**Por qué:** lo que el equipo de Kadesh sabe de un cliente (acuerdos, llamadas, por qué se le dio más prueba) vivía en la cabeza de alguien. El cliente nunca ve ni las notas ni a su dueño de cuenta.

## 2026-10-11 — Fase 3: resumen diario de uso y comparación por plan

**Qué:** `SaasCompanyDailyUsage` (una fila por empresa y día), armado por `rollupDailyUsage` (cron diario con `CRON_SECRET`, recalcula los últimos 3 días) y `pnpm usage:rollup` para días pasados. `adminCompanyTrends` da la tendencia de 12 semanas y compara las últimas 4 contra la mediana de su plan.

**Por qué:** las gráficas y comparaciones necesitan series por día; recalcularlas desde los logs crudos en cada vista sería caro. Recalcular un día reemplaza sus filas, así que el cron puede repetirse sin duplicar.

**Detalles:** los cambios que hace el admin de Kadesh no cuentan como actividad de la empresa; los WhatsApp importados tampoco (traen la fecha del chat original); con menos de 3 empresas en el plan la mediana no se muestra.

## 2026-10-11 — Fase 3: suspender y cerrar sesiones

**Qué:** `adminSetCompanySuspension` y `adminSetUserSuspension` (motivo obligatorio) y `adminRevokeSessions` (una persona o todo el equipo). Suspender también cierra las sesiones abiertas. El guardián de sesión (`auth/sessionGuards.ts`) revisa en cada petición la `sessionVersion` del token contra la de la base, la suspensión de la persona y de su empresa, y si la cuenta está anonimizada. El login con contraseña o con Google de una cuenta suspendida responde "Tu acceso a Kadesh está suspendido…" (solo a quien sabe la contraseña: con datos malos sigue saliendo el error genérico, así no se revela si el correo existe) y queda como intento fallido en `UserAuthLog`.

**Por qué:** las sesiones duran 30 días y no se guardan en ningún lado, así que no había forma de sacar a alguien. Subir un número de versión en `User` las invalida todas sin guardar sesiones.

**Límites:** no se puede suspender ni sacar a uno mismo ni al equipo de Kadesh, ni suspender una empresa que tenga gente de Kadesh (dejaría fuera a Operaciones). La suspensión no toca Stripe: si hay que dejar de cobrar, se cancela aparte.

## 2026-10-11 — Fase 3: "entrar como" en solo lectura

**Qué:** `adminStartImpersonation(userId, reason)` entrega un token de la persona que dura una hora y trae `impersonation: { adminId, expiresAt, reason }`. El plugin `auth/impersonation.ts` bloquea toda mutación con ese token salvo `endImpersonation`, `trackEvents` (que con ese token no registra nada) y `remainingCredits` (es una lectura declarada como mutación; el panel la pide al cargar). El front guarda el token del admin, entra con el de la persona, muestra una barra fija y al salir llama `endImpersonation` y restaura el token. El inicio y el fin quedan en Actividad con el admin como actor.

**Por qué:** para soporte hace falta ver exactamente lo que ve el cliente. En solo lectura no hay riesgo de cambiar nada a su nombre ni de gastar sus créditos, y no ensucia su analítica (ni secciones ni minutos). El bloqueo vive en un solo lugar (el plugin) para no depender de que cada mutación lo recuerde.

**Detalles:** el error de solo lectura sale con estado HTTP 200 (con 500, Apollo Client lo trataba como falla de red y en desarrollo tapaba la pantalla). Cada mutación bloqueada se registra en el log del servidor con su nombre. Con "entrar como" no arranca el tour de bienvenida de la persona.

## 2026-10-11 — Fase 3: transferir la propiedad

**Qué:** `adminTransferCompanyOwnership(companyId, newOwnerId, removeOtherAdmins)` da el rol de administrador de empresa a otra persona del equipo; opcionalmente lo quita a los demás (sin tocar al equipo de Kadesh; quien se queda sin rol de empresa queda como `user_company`).

**Por qué:** cuando el dueño original se va, alguien más tiene que administrar la cuenta. La facturación no cambia: la tarjeta y el cliente de Stripe siguen siendo de quien pagó.

## 2026-10-11 — Fase 3: derechos ARCO

**Qué:**
- `adminExportPersonData`: JSON con perfil, roles, empresa, accesos (con IP y navegador), actividad, días activos, pagos y suscripciones al blog. CLABE y tarjeta enmascaradas; nunca contraseña ni tokens.
- `adminAnonymizeUser` (hay que escribir el correo de la cuenta y un motivo): borra nombre, correo, teléfonos, cumpleaños, foto, datos bancarios y contraseña; quita empresa, roles y espacios; sube `sessionVersion`; limpia IP, navegador y correo de sus accesos y eventos, el nombre del remitente en sus WhatsApp, y su nombre y correo en los textos de eventos de su empresa; borra sus suscripciones al blog y avisos push.

**Por qué no se borra la fila:** actividades, cotizaciones y demás datos del CRM de la empresa apuntan a esa persona; borrarla rompería esos registros. La fila queda como "Usuario eliminado" sin datos personales y sin acceso. Es irreversible.

**Qué no hacer:** no escribir datos personales en el motivo (queda en Actividad).

## 2026-10-11 — Fase 3: se quitó `customAuth`

**Qué:** se borró la mutación `customAuth`.

**Por qué:** creaba o "iniciaba sesión" a una cuenta con solo su correo, sin contraseña, y devolvía sus datos. Ningún front la usaba y estaba rota (pedía un campo `role` que ya no existe), pero "arreglarla" habría abierto la puerta a entrar con solo saber un correo.

