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


## 2026-10-11 — Fase 4: salud de cada cuenta (0–100)

**Qué:** `scoreHealth` (`utils/analytics/health.ts`) califica a cada empresa con lo que hizo en las últimas 4 semanas que terminan ayer (resumen diario + latido):

| Parte | Máx. | Meta |
| --- | --- | --- |
| Constancia | 30 | 16 días con actividad de 28 |
| Equipo | 15 | Que entre todo el equipo |
| Uso | 25 | 60 puntos: extracción ×3, cambio de CRM ×1, actividad ×2, cotización ×4, WhatsApp ×0.5 |
| Tiempo | 15 | 2 horas con el panel abierto por persona |
| Pago | 15 | Plan activo (prueba = 10, con pago fallido −5) |

Las metas se ajustan a la antigüedad (una empresa de 5 días no puede tener 16 días activos). Si casi todo su uso fue hace más de 2 semanas, Constancia, Uso y Tiempo valen menos, hasta la mitad: en la prueba, una empresa que dejó de entrar seguía saliendo "sana" (77) por lo que hizo antes, aunque su señal decía que el uso cayó 100%. Si más de 30% de sus extracciones fallan, resta 5. 70 o más = sana, 40–69 = por observar, menos de 40 = en riesgo.

**Por qué una regla y no un modelo:** con pocas empresas un modelo no aprende nada confiable, y una regla se puede explicar al equipo ("le faltan días activos"). Sirve para ordenar a quién atender, no para predecir.

**Señales:**
- *Riesgo de baja*: pago vencido; nadie del equipo ha entrado (después de sus primeros 3 días: recién registrada todavía no es riesgo); nadie entra hace 14 días o más; el uso de las últimas 2 semanas cayó 40% o más contra las 2 anteriores; o salud baja con 3 semanas o más de antigüedad.
- *Oportunidad de venta*: se quedó sin créditos antes del día 20; vio módulos de otro plan o pidió mejorar 2 veces o más; o está en prueba con salud de 60 o más.

Cada señal trae un motivo (`reason`) para que Inicio no repita avisos que ya tiene: pago vencido ya sale como `past_due`/`unpaid`, una cuenta activa sin accesos como `inactive` y quedarse sin créditos como `no_credits`. Por eso en "Requiere atención" solo se agregan `churn_risk` (caída de uso, salud baja o prueba sin uso) y `upsell`.

**Dónde se ve:** `adminHealth` (lista con filtros y conteos), columna de salud y orden "peor salud primero" en `adminCompanies`, y la tarjeta Salud del 360. Sin resumen diario la salud no se muestra (`ready: false`): saldría en ceros.

**Quién no cuenta:** toda la analítica deja fuera las cuentas de prueba interna y las empresas del equipo de Kadesh (las que tienen un admin de plataforma): no son clientes y en la prueba la empresa "Kadesh" salía en Inicio como "riesgo de baja". Los KPIs de Inicio de la Fase 1 siguen igual (solo excluyen las de prueba) para no cambiar números que ya se usan.

## 2026-10-11 — Fase 4: activación, retención y uso

**Activación (`adminActivationFunnel`):** de las empresas registradas en el periodo, cuántas llegaron a cada paso y la mediana de días: llenó su perfil de negocio, primera extracción, primer contacto con un lead (actividad, WhatsApp enviado o lead movido de etapa), primera cotización y pagó (cobro exitoso o plan con costo activo). Cada paso se cuenta por separado y no como embudo estricto: hay quien paga sin cotizar, y un embudo estricto lo escondería. El perfil de negocio no guarda fecha, así que no tiene mediana.

**Retención (`adminCohorts`):** por mes de registro, qué parte de las empresas usó Kadesh cada mes después. "Usó" = latido del panel, login, extracción, evento del panel (sin los del admin de Kadesh) o cotización. Todo en hora de CDMX. Es retención por uso, no por pago: el historial de pagos por mes no existe completo.

**Uso (`adminEngagement`):** personas activas por día (latido), DAU promedio, WAU, MAU, DAU ÷ MAU, empresas activas, módulos que usa cada plan (resumen de 30 días) y secciones más abiertas. Sin cuentas de prueba ni el equipo de Kadesh, que usan el panel a diario y lo inflarían. Los días terminan ayer: hoy va a medias y parecería una caída.

## 2026-10-11 — Fase 4: demanda no cubierta

**Qué:** `adminDemandGaps` junta las extracciones exitosas con pocos resultados (nuevos + los que ya estaban en la base; por defecto 5 o menos) por giro, por zona (cuadro de 0.1°, unos 11 km) y por giro + zona.

**Por qué así:** los descartados por calificación no cuentan (los quitó el filtro del cliente, no la falta de negocios) y las corridas con error tampoco (son fallas, no demanda). Un hueco necesita al menos 2 corridas flojas: una sola puede ser un error de dedo.

## 2026-10-11 — Fase 4: de dónde llegan los clientes

**Qué:** `User.signupAttribution` guarda el primer contacto antes de registrarse: `utm_*`, dominio del sitio que la mandó y página de entrada. Lo junta el front en la primera visita y lo manda `registerUser(attribution)` o `authenticateUserWithGoogle(attribution)` (solo en altas nuevas). `adminAcquisition` agrupa las empresas por canal, página de entrada y campaña, con cuántas extrajeron y cuántas pagaron.

**Reglas:**
- El servidor limpia todo (`cleanAttribution`): solo llaves conocidas y textos cortos; del referrer solo el dominio y de la página la ruta sin query (la URL completa puede traer datos de la persona).
- El campo solo lo lee el admin de Kadesh y nadie lo escribe por la API: si alguien lo manda dentro de `data` al registrarse, se ignora.
- Canal = `utm_source`, si no el dominio que la mandó, si no "Directo". Con código de referido el canal es "Referido" aunque traiga UTM. Las cuentas anteriores salen como "Sin dato".
- La atribución es de quien creó la cuenta: los invitados no la traen.

**Privacidad:** es analítica del sitio, así que si la persona rechazó las cookies el front no guarda nada. Hay que mencionarla en el Aviso de privacidad.

## 2026-10-11 — El Prisma de Keystone devuelve los errores en vez de lanzarlos

**Qué se encontró:** `context.prisma` (Keystone 6) atrapa los errores de Prisma y los regresa como resultado (`GraphQLError`) en lugar de lanzarlos. Un `create` que falla por un campo único no truena: devuelve el error y el código sigue como si nada.

**Qué se cambió:** `optionalRead` ahora trata un error devuelto igual que uno lanzado, y las consultas SQL crudas nuevas pasan por `unwrapPrisma`, que vuelve a lanzar el error para que no se confunda con "sin filas".

**Qué no hacer:** no dar por hecho que un `await prisma.x.create(...)` con el Prisma de Keystone lanza si falla. Si importa, revisar `resultado instanceof Error`.

## 2026-10-12 — Sesión terminada: el panel ya no se queda vacío

**Qué pasaba:** al usar "Cerrar sesiones del equipo", el servidor dejaba de reconocer el token, pero el navegador no se enteraba: la persona se quedaba en un panel vacío ("No hay una empresa vinculada", "No se pudo guardar"). El front a propósito no borra al usuario cuando hay token y el servidor no lo reconoce (por un caso del login con Google), así que nunca salía.

**Qué se cambió:**
- El guardián de sesión anota por qué descartó el token de la petición: `revoked` (sesiones cerradas), `suspended`, `anonymized`, `impersonation_expired` o `expired` (vencido o inválido). `sessionEndedNoticePlugin` lo pone en la respuesta: `extensions.session: { status, message }`. Sin token no se agrega nada.
- El front (Apollo y el latido del registro de uso) ve ese aviso, borra el token y lleva al login con el mensaje y con `redirect` para volver a donde estaba. Si es un admin en "entrar como", en vez de eso vuelve a Operaciones con su sesión.
- `sessionBlockReason` revisa primero suspensión y anonimización y después la versión: suspender también sube la versión, y si no la persona vería "tu sesión expiró" en lugar del aviso de suspensión.

**Por qué en la respuesta y no con un error:** con un error, cada pantalla tendría que manejarlo; con el aviso en `extensions` los datos siguen igual (vacíos) y un solo lugar del front decide qué hacer.

## 2026-10-12 — Créditos del mes: dos peticiones a la vez ya no fallan

**Qué pasaba:** la primera vez del mes que una empresa abría el panel, `ensureSaasCompanyCreditPeriod` buscaba el periodo, no lo encontraba y lo creaba. Si llegaban dos peticiones juntas (el panel pide créditos en varios lugares al cargar), las dos intentaban crearlo y una fallaba con "Unique constraint failed on periodKey".

**Qué se cambió:** si crear falla, se vuelve a buscar el periodo; si ya existe (lo creó la otra petición), se usa ese. Solo la petición que lo creó escribe los movimientos iniciales del ledger, así que el alta del plan no se duplica.

## 2026-10-12 — Registro: solo datos personales

**Qué pasaba:** `registerUser` crea con `sudo` y pasaba todo `data` (`UserCreateInput`) salvo roles y empresa. Quien se registraba podía mandar `userTest`, `permissions`, `verified`, `referralCode`, espacios de trabajo, etc.

**Qué se cambió:** solo se aceptan `name`, `lastName`, `secondLastName`, `username`, `email`, `password` y `phone` (`REGISTER_ALLOWED_FIELDS`); lo demás se ignora sin error. `product`, roles, empresa y atribución los pone el servidor.

**Qué no hacer:** si el formulario de registro necesita un campo nuevo, agrégalo a la lista; no vuelvas a pasar `data` completo.

## 2026-10-12 — Fase 5: velocidad comercial

**Qué:** historial de etapas (`TechLeadStageChange`, ver su README) y `adminSalesVelocity(days, companyId)`:

- **Cierre:** ganados (Propuesta aceptada o Cerrado ganado) contra perdidos (Rechazada, Cerrado perdido, Descartado) cerrados en el periodo; valor estimado de lo ganado.
- **Ciclo de venta:** mediana de días desde que el lead entró al pipeline hasta ganarse. Solo cuenta leads que vimos entrar (si el historial empieza a medio camino, no se puede saber).
- **Por etapa:** cuántos entraron, cuántos avanzaron (etapa más adelante; "Sin respuesta" vale lo mismo que "Contactado"), cuántos se perdieron, mediana de días en la etapa y estancados.
- **Estancados:** tratos abiertos de Contactado en adelante sin moverse en 14 días.
- **Primer contacto:** horas desde que el lead entró hasta moverlo a Contactado o más, registrar una actividad o mandarle un WhatsApp.
- **WhatsApp:** tiempo para contestar a un lead (varios mensajes seguidos del lead cuentan como uno), contestados en 1 h y en cuántas conversaciones que empezó la empresa contestó el lead (7 días).

**Por qué medianas:** un lead olvidado 200 días movería el promedio y no diría nada del resto. La mediana dice "la mitad tarda menos que esto", y así se explica en la ayuda.

## 2026-10-12 — Fase 5: errores por empresa

**Qué:** `appErrorsPlugin` (Apollo) registra `app.error` en `ActivityEvent` cuando una petición de alguien con sesión falla: nombre de la operación, mensaje y código. Nunca las variables (pueden traer datos personales). El mismo error de la misma persona y operación se registra una vez cada 10 minutos. No cuenta el bloqueo de "entrar como" (es a propósito). Se ve en Actividad → Errores, en las alertas del 360 (`adminCompanyInsights.appErrors`) y en "Requiere atención" con 3 o más en 24 h (`app_errors`).

**Por qué:** para enterarse de un error (por ejemplo, el front pidiendo algo que el back aún no tiene) antes de que el cliente se queje.

## 2026-10-12 — Analítica como módulo de pago para los clientes

**Qué:** sección **Analítica** en el panel del cliente (módulo `analytics`, se activa por plan en Operaciones → Planes → Módulos) con la consulta `companyAnalytics` (`graphql/customs/queries/analytics/companyAnalytics.ts`): cierre, ciclo de venta, primer contacto, WhatsApp, etapas, desempeño por vendedor y tratos estancados con enlace al lead.

**Reglas:**
- La empresa sale siempre de la sesión: la consulta no recibe empresa, así nadie puede pedir números de otra.
- Revisa el plan en el servidor (`companyHasPlanFeature`, `utils/saas/planFeatures.ts`, que ahora también usa Calendario) y los permisos `analitica.ver` y `analitica.ver_equipo`. Sin permiso de equipo (por defecto todos menos admin de la empresa y Gerencia) solo cuenta los leads asignados a esa persona y no ve la tabla del equipo.
- El cálculo es el mismo de Operaciones: se movió a `utils/analytics/salesVelocity.ts` y `adminSalesVelocity` lo usa también (mismos resultados, misma prueba).

**Por qué:** Kadesh la vende como módulo aparte; un vendedor no debe ver el desempeño de sus compañeros salvo que la empresa lo decida.

## 2026-11-04 — Fase 6.0: se acaba el acceso abierto genérico

**Qué:** 25 listas usaban `utils/generalAccess/access.ts`, que dejaba a **cualquiera, sin sesión**, leer, editar o borrar cualquier fila. El archivo se borró. Las listas ahora usan reglas de `utils/access/presets.ts` o su propio `<Lista>.access.ts`:

| Listas | Ahora |
| --- | --- |
| `Ad`, `Cart`, `Order`, `Payment`, `PaymentMethod`, `Product`, `WishList` (sin uso en ningún front) | Solo admin |
| `AnimalType`, `AnimalBreed`, `PetPlaceType`, `Category`, `Tag`, `Schedule`, `SocialMedia` | Lectura pública, escritura admin |
| `ContactForm`, `BlogSubscription` | Cualquiera crea; solo el admin lee y edita. El mensaje entra como "Nuevo"; la suscripción queda a nombre de la sesión (o de nadie) y activa. La baja sigue con `unsubscribeBlog` (sudo) |
| `PostComment`, `PostLike`, `PostFavorite`, `PetPlaceLike`, `Review` | Lectura pública (conteos), crear con sesión y a nombre propio, editar solo admin, borrar el autor o admin. `Review` además valida calificación 1-5 y que sea de una veterinaria, y un cliente no puede llenar `google_user*` ni `product` |
| `PostView` | Cualquiera la registra (a nombre de la sesión o de nadie); nadie edita; solo admin borra |
| `Post` | El público solo ve publicados con fecha ya cumplida (o sin fecha); el admin ve todo; escribir es del admin. ClickUp y la publicación programada usan sudo |
| `PetPlaceService` | Anónimo ve aprobados; con sesión, además los que pidió o los de su clínica; escribir es del admin |
| `PetPlace` | Lectura pública; crear con sesión (queda a su nombre, pendiente y con fecha de reclamo); editar y borrar, admin. El teléfono, notas, rol y fecha del reclamo solo los leen el dueño o el admin, y solo el admin filtra por ellos; `pipelineStatus` es solo admin; verificación, slug, Google y relaciones solo los manda el admin |

**Por qué:** antes cualquiera podía leer todos los mensajes de contacto (nombre, correo, teléfono) y los correos suscritos al blog, marcar una veterinaria como verificada, borrar reseñas o artículos, o ver pagos y pedidos. Es la puerta de abuso más grande que había.

**Por qué no rompe nada:** el diseño revisó cada operación de landing, business y móvil. Los fronts mandan solo campos permitidos y los valores que el servidor fuerza salen iguales. El dueño de una veterinaria edita con `updateMyPetPlace`/`claimPetPlace` (sudo). El schema de GraphQL y Prisma no cambia (los campos privados van con `isFilterable`/`isOrderable` como función), así que móvil no regenera nada.

**Ojo con Keystone:** una lectura denegada no da error, devuelve null, `[]` o 0. Por eso las listas que alimentan conteos públicos (comentarios, likes, calificación, `isOpen`) siguen con lectura pública. Un post que vuelve a borrador sale `null` en los likes, favoritos y comentarios de una persona: la landing filtra esas filas (móvil ya lo hacía).

**Qué no hacer:** no dar `() => true` a update o delete de ninguna lista; usar un preset o un `.access.ts`.

**Pendiente (fuera de esta fase):**
- Las veterinarias registradas se ven públicas de inmediato, aunque el texto dice "Revisamos cada solicitud".
- Suscribirse de nuevo al blog después de darse de baja falla, y los mensajes revelan si un correo está suscrito.
- `PetPlace.user` y el `author` del blog salen null para visitantes sin sesión (ya pasaba).
- Los campos virtuales de `PetPlace` (`isOpen`, `reviewsCount`, `averageRating`) podrían leer con `sudo()` para no depender de la lectura pública.

## 2026-11-04 — Fase 6.1: app, pantalla e IP en cada evento; errores de cualquier persona

**Qué:**
- Los fronts mandan en cada petición `x-kadesh-app` (`pet-web`, `business-web`, `pet-mobile`) y `x-kadesh-page` (la pantalla). `ActivityEvent` los guarda en `app` y `page`. De la URL solo se guardan la ruta y `tab`, `vista`, `clinic` y `pet` (`cleanPage`).
- `appErrorsPlugin` registra también los errores de visitantes sin sesión: mismo deduplicado de 10 min (por IP) y tope de 30 por IP por hora. Guarda si era consulta o cambio (`opType`) y los **nombres** de las variables (`data.name`, `where.id`), nunca sus valores.
- Nuevo tipo `app.client_error` por `trackEvents` para lo que el servidor no ve: la petición no llegó o volvió 5xx/413/429 (`network`), la pantalla se cayó (`crash`), un error de código suelto (`script`) o no cargó el código tras un despliegue (`chunk`). Es lo único que `trackEvents` acepta sin sesión: 20 por IP cada 10 min y deduplicado de 10 min.
- `adminActivityFeed` devuelve `ip`, `userAgent`, `app` y `page`, y filtra por `app`, `ip` y `fingerprint`. ARCO exporta y anonimiza los campos nuevos.

**Por qué:** en Operaciones no se veía en qué pantalla ni desde qué sistema le fallaba algo a alguien, aunque la IP y el navegador ya se guardaban. La mayoría de quienes usan Kadesh Pet navega sin cuenta, así que sus errores no quedaban.

**Ojo con la IP:** `requestIp` toma el primer `x-forwarded-for`. Si el proxy de Railway agrega en lugar de reemplazar, el cliente podría falsificarla, y la Fase 6.5 (límites y bloqueo) depende de ella. Antes de confiar en el bloqueo, probar con `curl -H 'X-Forwarded-For: 1.2.3.4'` contra el back: si la fila guarda `1.2.3.4`, poner `CLIENT_IP_HEADER` (`x-forwarded-for-last`, `x-real-ip` o `x-envoy-external-address`, lo que Railway ponga).

**Qué no hacer:** no guardar valores de variables ni la URL completa; no reportar desde el navegador los errores de GraphQL (el back ya los registra con app, pantalla e IP).

## 2026-11-04 — Fase 6.2: bandeja de Errores

**Qué:** los `app.*` se agrupan por `fingerprint` (tipo + operación o tipo de falla + mensaje sin números, ids ni correos; los del navegador también por app). Operaciones → Errores muestra cada grupo con veces, personas, apps, pantalla y navegadores, y permite resolver, ignorar o reabrir con una nota (`ErrorIssue`). Si un error resuelto vuelve a pasar, sale como reabierto. El menú muestra cuántos siguen abiertos con actividad en 24 h.

**Por qué:** una lista de eventos no dice qué error es nuevo, cuál afecta a más gente o cuál ya se corrigió.

## 2026-11-04 — Fase 6.3: dispositivos e IPs por persona

**Qué:** `adminPersonDevices` une eventos y accesos de una persona por IP + navegador, y lista otras cuentas que usaron sus IPs (90 días). Una IP con más de 15 cuentas se marca "de muchas cuentas" y no lista personas. Los accesos (`UserAuthLog`) ya muestran IP y dispositivo en Operaciones.

**Por qué:** detectar cuentas compartidas o multicuentas. Coincidir en una IP es una señal para revisar, no una prueba (familias, oficinas, redes móviles, VPN).

## 2026-11-04 — Fase 6.4: actividad de Kadesh Pet

**Qué:** categoría `pet` en Actividad. Se registran: publicar, editar y borrar reportes; cambios de estado (no la bitácora inicial); comentarios; reclamos; registro, edición, reclamo y verificación de veterinarias; reseñas; altas con el formulario genérico (`auth.signup`) y el formulario de contacto (`contact.form_submitted`, en Navegación). La landing manda qué pantallas abre una persona con sesión y su latido (tiempo activo), como el panel de Negocios.

**Por qué:** de Kadesh Pet solo quedaban fusiones, duplicados y reclamos; sin esto no se ve quién publica de más, comenta en masa o registra veterinarias falsas.

**Qué no hacer:** no guardar el texto de comentarios, reseñas ni mensajes (solo ids, largo y calificación). Las ediciones y borrados del servidor (sudo) no se registran aquí: esos flujos dejan su propio evento.

## 2026-11-04 — Fase 6.5: límites contra abuso, avisos y bloqueo de IP

**Qué:**
- `rateLimitPlugin` (Apollo) limita por IP o por persona: logins con Google (20/IP/15 min), registros (5/IP/h), reportes (10/persona/h y 20/IP/h), comentarios (30/persona/h), reseñas (10/persona/día), contacto (5/IP/h) y veterinarias (3/IP/día). Responde `RATE_LIMITED` con cuánto esperar. Admins de plataforma y la automatización de reportes no tienen límite.
- Login con contraseña: solo cuentan los intentos fallidos (10 por IP y 5 por correo en 15 min). Al llegar al límite, los siguientes responden sin probar la contraseña y quedan en `UserAuthLog`.
- Al pasarse: `security.rate_limited` en Actividad (categoría `security`). Si la misma IP o persona se pasa 3 veces en una hora, o es de login, aviso `security.alert` a la campana de los admins (y correo con `ADMIN_NOTIFICATION_EMAILS=on`), con 30 min entre avisos.
- `BlockedIp` + middleware en `/api/graphql` (antes de la sesión y de Apollo): responde `IP_BLOCKED`. Se bloquea desde Operaciones → Seguridad, Actividad o Dispositivos. No deja bloquear la IP propia; si un admin usó la IP en 7 días pide confirmar. Salida de emergencia: `pnpm security:unblock <ip>` (o `:prod`).

**Por qué:** no había ningún límite fuera de IA: cualquiera podía registrar cuentas, reportes o comentarios en masa, o probar contraseñas sin freno.

**Limitaciones:** los contadores viven en memoria del proceso (se reinician al desplegar y no se comparten entre réplicas). Alcanza con una instancia en Railway; si se escala, moverlos a la base o a Redis.

**WhatsApp:** para que el aviso llegue por WhatsApp hace falta una plantilla UTILITY aprobada por Meta, p. ej. `kadesh_admin_alerta_seguridad`: "Alerta de seguridad en Kadesh: {{1}}. {{2}} intentos en {{3}} min. Revisa Operaciones → Seguridad." Cuando esté aprobada, agregar `security.alert` a `WHATSAPP_TEMPLATES` (`utils/notifications/whatsapp.ts`). Mientras, solo campana y correo.

**Qué no hacer:** no bloquear por IP sin confirmar antes que la IP es confiable (ver Fase 6.1).
