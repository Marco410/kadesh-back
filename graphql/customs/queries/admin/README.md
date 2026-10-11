# Queries de Operaciones (admin de plataforma)

Lecturas agregadas para la pantalla **Operaciones** del front (`/panel/clientes/admin`). Keystone solo genera listas y conteos; aquí van los cruces y agregados (`groupBy`, `aggregate`) que el front no puede armar sin bajar miles de filas.

## Acceso

Solo `Role.ADMIN` (`isPlatformAdmin`). Cualquier otro rol recibe un error GraphQL ("Solo un administrador de Kadesh…"). Después de validar se usa `context.sudo().prisma`.

## Queries

### `adminCompanies(input)`

Lista de empresas con su **estado vigente**: el de la suscripción más reciente (`latestSubscriptionsByCompany`). No se filtra con `subscriptions.some` porque hay una fila por contrato y las viejas no siempre quedan canceladas.

- `search`: nombre de la empresa, correo de contacto, o nombre/correo de cualquier integrante.
- `status`: `all | active | trialing | past_due | unpaid | cancelled | none` (`none` = sin suscripción).
- `sort`: `recent` (alta) · `name` · `activity` (último acceso del equipo).
- Devuelve `statusCounts` con la búsqueda aplicada, para los chips de estado.
- Créditos del mes con el mismo cálculo que el panel del cliente (`companyCredits`).
- `lastSeenAt`: última vez que alguien del equipo tuvo el panel abierto (latido, `UserActivityDay`). El orden `activity` usa lo más reciente entre ese dato y el último login.

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

Las empresas cuyos usuarios son todos `userTest` no cuentan en KPIs ni MRR.

### `adminCompanyInsights(companyId, days = 30)`

Métricas del 360 de una empresa en la ventana: por persona (accesos, último acceso, última acción, leads asignados, actividades, cotizaciones, extracciones, IA, WhatsApp, tours), pipeline por etapa, extracciones, créditos por día (hora de CDMX), IA por función, actividades por tipo, seguimientos pendientes/vencidos, propuestas y cotizaciones por estatus, WhatsApp y calendario.

Alcance del CRM (`crmCompanyScope`): el item cuenta para la empresa si su workspace es de la empresa o, sin workspace, si quien lo creó o lo tiene asignado es de la empresa. El lead solo no basta porque los leads se comparten entre empresas.

Por persona también: `lastSeenAt` (latido), `activeDays`, `activeMinutes` y `changes` (eventos de `ActivityEvent` en la ventana, sin navegación).

`usage` (Fase 2): minutos activos del equipo (total y por día), personas que entraron, secciones del panel más abiertas, módulos bloqueados que vieron, clics en "mejorar plan" y exportaciones. `ready: false` mientras no exista la migración: el front oculta la tarjeta.

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

## Invariantes

- Nunca devolver prompts de IA, cuerpos de WhatsApp, contraseñas ni tokens.
- Fechas de calendario (`activatedAt`, `currentPeriodEnd`) como `YYYY-MM-DD`, igual que Keystone.
- `adminActivityFeed` mantiene su contrato: `ActivityEvent` entró como una fuente más.
- Las lecturas de `ActivityEvent` y `UserActivityDay` van en `try/catch` (`optionalRead`): sin migrar, todo responde con los datos de siempre.

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

