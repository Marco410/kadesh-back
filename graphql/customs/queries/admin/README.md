# Queries de Operaciones (admin de plataforma)

Lecturas agregadas para la pantalla **Operaciones** del front (`/panel/clientes/admin`). Keystone solo genera listas y conteos; aquí van los cruces y agregados (`groupBy`, `aggregate`) que el front no puede armar sin bajar miles de filas.

## Acceso

Solo `Role.ADMIN` (`isPlatformAdmin`). Cualquier otro rol recibe un error GraphQL ("Solo un administrador de Kadesh…"). Después de validar se usa `context.sudo().prisma`.

## Queries

### `adminCompanies(input)`

Lista de empresas con su **estado vigente**: el de la suscripción más reciente (`latestSubscriptionsByCompany`). No se filtra con `subscriptions.some` porque hay una fila por contrato y las viejas no siempre quedan canceladas.

- `search`: nombre de la empresa, correo de contacto, o nombre/correo de cualquier integrante.
- `status`: `all | active | trialing | past_due | unpaid | cancelled | none` (`none` = sin suscripción).
- `sort`: `recent` (alta) · `name` · `activity` (último acceso del equipo) · `health` (peor salud primero).
- Devuelve `statusCounts` con la búsqueda aplicada, para los chips de estado.
- Créditos del mes con el mismo cálculo que el panel del cliente (`companyCredits`).
- `lastSeenAt`: última vez que alguien del equipo tuvo el panel abierto (latido, `UserActivityDay`). El orden `activity` usa lo más reciente entre ese dato y el último login.
- `accountManager`: persona de Kadesh responsable de la cuenta. Filtro `accountManagerId` para "Mis cuentas".
- `suspendedAt`: si Kadesh suspendió el acceso de la empresa.
- `health` (Fase 4): salud resumida (puntaje, nivel, tendencia, señales). `null` mientras no haya resumen diario.

### `adminOpsSummary`

KPIs de Inicio: empresas por estado, pruebas por vencer (≤3 días), pagos con problema, registros y accesos de 7 días, extracciones de 24 h, llamadas IA de 7 días, créditos consumidos en el mes y MRR estimado (suscripciones `active` normalizadas a mes).

`leadsCreatedMonth` / `leadsReusedMonth`: suma de `created` y `alreadyInDb` de las extracciones correctas del mes. Los reutilizados salieron de la base, sin llamar a Google Maps ni a INEGI. Es el "ahorro en búsquedas" de Inicio.

`activeUsers7d`: personas que iniciaron sesión **o** tuvieron el panel abierto (latido) en 7 días.

`attention` es la lista **Requiere atención** (máx. 25, por severidad):

| `reason` | Cuándo |
|---|---|
| `past_due`, `unpaid` | Estado vigente con problema de pago |
| `trial_expired` | Prueba terminada sin pasar a pago |
| `trial_ending` | Prueba que vence en ≤3 días |
| `no_credits` | Activa o en prueba y sin créditos este mes |
| `sync_failures` | 2+ extracciones fallidas en 7 días |
| `checkout_failed` | Intentos de pago fallidos en 7 días sin un pago correcto después |
| `inactive` | Plan activo y nadie del equipo entra hace 14 días (último login o latido del panel, lo más reciente) |
| `churn_risk` | Salud (Fase 4): el uso cayó 40% o más, salud baja, o prueba en la que nadie entra. No repite pago vencido ni `inactive` |
| `upsell` | Salud (Fase 4): sin créditos antes del día 20 (si no salió ya como `no_credits`), intención de compra o prueba con buen uso |

Las empresas cuyos usuarios son todos `userTest` no cuentan en KPIs ni MRR.

### `adminCompanyInsights(companyId, days = 30)`

Métricas del 360 de una empresa en la ventana: por persona (accesos, último acceso, última acción, leads asignados, actividades, cotizaciones, extracciones, IA, WhatsApp, tours), pipeline por etapa, extracciones, créditos por día (hora de CDMX), IA por función, actividades por tipo, seguimientos pendientes/vencidos, propuestas y cotizaciones por estatus, WhatsApp y calendario.

Alcance del CRM (`crmCompanyScope`): el item cuenta para la empresa si su workspace es de la empresa o, sin workspace, si quien lo creó o lo tiene asignado es de la empresa. El lead solo no basta porque los leads se comparten entre empresas.

Leads asignados por persona y `leadsWithoutOwner` salen de `TechBusinessLead.salesPerson` (el estatus es uno por empresa, no por vendedor).

Por persona también: `lastSeenAt` (latido), `activeDays`, `activeMinutes` y `changes` (eventos de `ActivityEvent` en la ventana, sin navegación).

`usage` (Fase 2): minutos activos del equipo (total y por día), personas que entraron, secciones del panel más abiertas, módulos bloqueados que vieron, clics en "mejorar plan" y exportaciones. `ready: false` mientras no exista la migración: el front oculta la tarjeta.

### `adminCompanyTrends(companyId, weeks = 12)`

Tendencia por semana (las semanas terminan ayer, hora de CDMX) desde `SaasCompanyDailyUsage`: minutos activos, días activos, accesos, extracciones, leads nuevos y de la base, créditos, IA, cambios del CRM, actividades, cotizaciones y WhatsApp.

`benchmark`: totales de las últimas 4 semanas de esta empresa contra la **mediana** de las demás empresas con el mismo plan vigente (sin cuentas de prueba, contando a las que no hicieron nada). Con menos de 3 empresas para comparar, la mediana es `null`: no dice nada. `ready: false` si todavía no hay resumen diario (falta migrar o correr el cron).

### `adminActivityFeed(input)`

Línea de tiempo unificada a partir de los logs que ya existen:

| `type` | Fuente |
|---|---|
| `auth` | `UserAuthLog` (login con contraseña o Google, registro, fallos) |
| `extraction` | `TechLeadSyncLog` |
| `credits` | Ledger: altas del plan, recargas, ajustes (el consumo ya aparece en extracción e IA) |
| `admin` | Ledger `GRANT_ADMIN` (el admin que agregó créditos va en `referenceId`) |
| `ai` | `TechAiCallLog` (**sin** prompts ni respuestas) |
| `billing` | `SaasSubscriptionLog` (intentos de checkout) + `SaasPayment` que no fueron exitosos |
| `whatsapp` | Mensajes salientes (**sin** cuerpo) |
| `crm` | `TechSalesActivity`, `TechProposal` y los hitos de `SaasQuotation` (creada / enviada / aceptada) |
| `calendar` | Fallos de `TechGoogleCalendarSyncLog` |
| `team` | `ActivityEvent`: roles, permisos, altas de personas, espacios, datos de la empresa |
| `product` | `ActivityEvent`: navegación (secciones, módulos bloqueados, tours). **No entra en "todo"**: solo si se pide |

Además, `ActivityEvent` aporta a cada tipo sus eventos propios (cambios del CRM, ciclo de Stripe, ajustes, registro del admin). La categoría del evento es el tipo del feed. Los tipos de `FEED_HIDDEN_EVENT_TYPES` no se muestran porque ya salen de su tabla (cotización enviada/aceptada, cobro fallido o reembolsado). Antes de migrar esa tabla no existe y la fuente devuelve vacío.

Filtros: `companyId`, `userId` (en eventos propios: lo que hizo la persona y lo que le hicieron a su cuenta), `types`, `onlyErrors`, `search`. Pagina por cursor: `before` = `occurredAt` del último item; `nextBefore` trae el siguiente. Cada fuente pide `take + 1` filas, se mezclan por fecha y se corta.

### Analítica (Fase 4)

Todas excluyen las cuentas de prueba interna (`userTest`) y las empresas del equipo de Kadesh (con un admin de plataforma): `analyticsExcludedCompanyIds`. Las ventanas por día son de CDMX.

#### `adminHealth(input)`

Salud de 0 a 100 de cada empresa con las últimas 4 semanas que terminan ayer. La regla vive en `utils/analytics/health.ts` y los datos de muchas empresas a la vez en `healthData.ts` (resumen diario, latido, equipo, plan vigente, créditos agotados, intención de compra, pagos fallidos).

- `status`: por defecto `live` (activas, en prueba y con pago pendiente); también `all` o un estado.
- `label`: `healthy | watch | risk`. `flag`: `churn_risk | upsell`. `search` y `accountManagerId` como en `adminCompanies`.
- `sort`: `risk` (peor primero, por defecto) · `best` · `drop` (mayor caída) · `name`.
- `companyId`: solo esa empresa (tarjeta del 360); ignora los demás filtros.
- `counts`: niveles y señales con búsqueda y estado aplicados. `ready: false` si no hay resumen diario.

#### `adminActivationFunnel(input: { days })`

Empresas registradas en los últimos `days` (30–365) y cuántas llegaron a cada paso, con la mediana de días: perfil de negocio, primera extracción, primer contacto, primera cotización y pago. Los pasos salen de `milestones.ts`. `byMonth` repite los conteos por mes de registro.

#### `adminCohorts(input: { months })`

Retención por mes de registro (3–12 meses). `active[i]` = empresas de esa cohorte que usaron Kadesh `i` meses después del registro (latido, login, extracción, evento del panel sin los del admin, cotización). Una sola consulta SQL con `UNION ALL`.

#### `adminEngagement(input: { days })`

Personas y empresas activas por día (latido) hasta ayer, DAU promedio de 30 días, WAU, MAU, DAU ÷ MAU, módulos que usa cada plan (resumen de 30 días de empresas activas o en prueba) y secciones más abiertas (`ui.section_viewed`). Sin cuentas de prueba ni admins de Kadesh.

#### `adminDemandGaps(input: { days, threshold })`

Extracciones exitosas con `created + alreadyInDb <= threshold` (por defecto 5) por giro, por zona (cuadro de 0.1°) y por giro + zona (al menos 2 corridas flojas). Sin corridas con error.

#### `adminAcquisition(input: { days })`

Empresas registradas por canal, página de entrada y campaña (`User.signupAttribution` de quien creó la cuenta), con cuántas extrajeron y cuántas pagaron. Referido gana sobre UTM; sin dato = "Sin dato".

#### `adminSalesVelocity(input: { days, companyId })` (Fase 5)

Velocidad comercial desde `TechLeadStageChange`, actividades y WhatsApp: cierre, ciclo de venta, por etapa (entraron, avanzaron, perdidos, días, estancados), primer contacto, WhatsApp y una lista por empresa (más estancados primero). `dataSince` = desde cuándo hay historial. Ver `docs/operaciones/decisiones.md`.

`adminCompanyInsights.appErrors` y el motivo `app_errors` de "Requiere atención" salen de `app.error` (plugin `utils/activity/appErrorsPlugin.ts`).

### Kadesh Pet

#### `adminAnimals(...)` / `adminAnimalDetail(id)`

Lista y detalle de animales de la pestaña Kadesh Pet → Animales (ver `models/Pet/Animal/README.md`).

#### `adminNotificationLog(product, type, channel, result, search, entityId, days, take, skip)`

Kadesh Pet → Avisos. Cada aviso (una fila por destinatario) con a dónde se fue: campana (`readAt`), push y WhatsApp (ver «Entrega» en `models/Notification/README.md`). `channel`: `push` / `whatsapp` / todos. `result`: `delivered` (WhatsApp incluye «aceptado» mientras llega el acuse), `failed`, `skipped` (sin app o WhatsApp no mandado) o todos. `days` 1–365 (7 por defecto). `summary` y `types` salen de la misma ventana, sin el filtro de canal (y `types` sin el de tipo).

#### `adminZoneAlerts(search, status, take, skip)` / `adminZoneAlertPreview(lat, lng)`

Kadesh Pet → Alertas de zona. Personas con alertas encendidas o con zona elegida; `status`: `active` (encendidas y con zona), `inactive` o `all`. Cada fila trae su zona, radio, dispositivos con push, estado de WhatsApp (`on`, `off`, `no_phone`, `muted`) y alertas recibidas en 30 días. `adminZoneAlertPreview` dice quién recibiría una alerta en un punto con `findZoneAlertCandidates` (la misma regla que la alerta real) y marca a quien ya llegó al tope del día; no manda nada. Las acciones están en la mutación `adminUpdateZoneAlerts` (`mutations/admin/zoneAlerts.ts`), que deja `admin.zone_alerts_updated` en la actividad.

#### `adminPetSummary(input: { days })`

Cifras de Kadesh Pet → Resumen. `days` (7–3650) es la ventana de "nuevos en el periodo" y de la interacción; `null` = todo el historial (`newPrevPeriod` queda en 0).

- `animals`: total, nuevos (y los del periodo anterior, para el % de cambio), publicados y sin publicar en Facebook, duplicados fusionados, y desgloses por estatus actual (siempre los 8 de `ANIMAL_LOGS_OPTIONS` + `none`, en ese orden), tipo (`AnimalType.name`), origen (`user` / `admin`), `reportedBy`, y top 8 de estados y ciudades del último registro de la bitácora.
- `places`: fichas, veterinarias (tipo `veterinary`), verificadas, importadas de Google (`google_place_id`), reseñas, likes, nuevas, y desgloses por `claimStatus`, tipo y top 8 de estados.
- `users`: cuentas de Kadesh Pet (total y nuevas).
- `engagement`: vistas, vistas con sesión, favoritos y comentarios (`kind = comment`) en la ventana, y los 5 animales más vistos.
- `pending`: reclamos de animales, fichas en revisión, servicios por aprobar y animales sin publicar en Facebook.

#### `adminPetSeries(input: { metric, granularity, range, breakdown, placeType })`

Serie para las gráficas del Resumen.

| `metric` | Fecha que cuenta |
|---|---|
| `animals` | `Animal.createdAt` (sin duplicados fusionados) |
| `places_created` | `PetPlace.createdAt` (casi todas se importan solas de Google) |
| `places_claimed` | `PetPlace.claimedAt` (último reclamo de cada ficha) |
| `places_verified` | `PetPlace.verifiedAt` |
| `pet_users` | `User.createdAt` de cuentas de Pet |

- `granularity`: `day | week | month` (default `week`). Semanas de lunes, como `date_trunc('week')`.
- `range`: `30d | 90d | 180d | 365d | all` (default `90d`). El primer periodo se completa (si el rango empieza un miércoles, la semana arranca el lunes). `all` empieza en el primer registro de la métrica. Con `day` nunca más de 90 barras: el rango se recorta y `from` dice desde cuándo. Tope general: 400 puntos.
- `breakdown` (solo `animals`): `none | status | origin`. `segments` suma el `total` de cada punto.
- `placeType` (solo `places_*`): un `PetPlaceType.value`.
- El periodo de hoy va incluido aunque esté a medias (`to` es su inicio).

Reglas de las dos queries:

- Estatus de un animal = su registro más reciente en la bitácora (`date_status` y luego `createdAt`), igual que `adminAnimals` y `petLandingStats`. "Registrado" (la etiqueta guardada como valor) cuenta como `register`; sin bitácora o un valor desconocido = `none`.
- Los duplicados fusionados (`duplicateOf`) no cuentan en nada: por eso `animals.total + duplicatesMerged` = `petLandingStats.animals`.
- Origen `admin` = quien lo publicó tiene el rol admin, igual que el filtro "Publicado por" de la lista.
- Usuarios de Pet = `product = pet`, sin empresa y sin `userTest`. Las cuentas de Negocios anteriores a `User.product` quedaron como `pet`; se distinguen porque tienen empresa.
- Días en hora de CDMX; los periodos vacíos se rellenan en 0.

## Invariantes

- Nunca devolver prompts de IA, cuerpos de WhatsApp, contraseñas ni tokens.
- Fechas de calendario (`activatedAt`, `currentPeriodEnd`) como `YYYY-MM-DD`, igual que Keystone.
- `adminActivityFeed` mantiene su contrato: `ActivityEvent` entró como una fuente más.
- Las lecturas de `ActivityEvent` y `UserActivityDay` van en `optionalRead`: sin migrar, todo responde con los datos de siempre.
- El Prisma de Keystone **devuelve** los errores en vez de lanzarlos. `optionalRead` cubre los dos casos; las consultas SQL crudas usan `unwrapPrisma` para que un error no pase como "sin filas".

## Decisiones

### 2026-10-10 — Agregados en el back, no en el front

Operaciones necesitaba estado vigente por empresa, conteos por persona y un feed mezclado. Hacerlo con las listas de Keystone obligaba a bajar todas las suscripciones y logs al navegador. Se resuelve con Prisma en estas cuatro queries, solo para admin de plataforma.

### 2026-10-10 — Fase 2: el feed suma eventos propios sin repetir hechos

Qué: `activityEventSource` lee `ActivityEvent`. Nuevos tipos `team` y `product`; `product` queda fuera de "todo".

Por qué: los cambios hechos por personas, el ciclo de Stripe y el registro del admin no tenían tabla. La navegación es mucho volumen (una fila por sección abierta) y taparía lo importante si saliera por defecto.

Qué no hacer: no mostrar en el feed un evento que ya sale de otra tabla; agrégalo a `FEED_HIDDEN_EVENT_TYPES`.

### 2026-10-10 — "Último acceso" incluye el latido del panel

Qué: `adminCompanies.lastSeenAt`, `activeUsers7d` y la alerta `inactive` usan lo más reciente entre el último login y el latido.

Por qué: la sesión dura 30 días. Con solo `lastLoginAt`, un equipo que usa el panel a diario sin volver a iniciar sesión salía como inactivo.


### 2026-10-11 — Fase 4: analítica con regla simple y datos del resumen diario

Qué: seis queries nuevas (salud, activación, retención, uso, demanda y adquisición), salud en `adminCompanies` y dos motivos nuevos en "Requiere atención".

Por qué: el equipo necesitaba saber a quién llamar (riesgo de baja), a quién venderle más y qué canales traen clientes que sí usan y pagan. Todo sale de tablas que ya existían (resumen diario, latido, logs) más un campo nuevo, `User.signupAttribution`. La salud es una regla explicable y no un modelo: con pocas empresas un modelo no sería confiable. Detalle en `docs/operaciones/decisiones.md`.

### 2026-11-03 — Resumen de Kadesh Pet con dos queries

Qué: `adminPetSummary` (cifras del momento y de la ventana) y `adminPetSeries` (una serie por gráfica), en `adminPet.ts`.

Por qué: el estatus vive en la bitácora y hay que tomar el último registro de cada animal; contarlo en el front obligaría a bajar todas las bitácoras. La serie va aparte para que cambiar de agrupación o desglose no recalcule todo el resumen. La agrupación se hace en SQL sobre la hora de CDMX (`AT TIME ZONE`), con una consulta por métrica porque la columna de fecha no se puede parametrizar.

Qué no hacer: no contar estatus con `logs: { some: { status } }` (trae animales que alguna vez lo tuvieron); no sumar duplicados fusionados; no pedir barras por día de más de 90 días.
