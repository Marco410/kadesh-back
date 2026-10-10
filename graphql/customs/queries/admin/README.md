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

### `adminOpsSummary`

KPIs de Inicio: empresas por estado, pruebas por vencer (≤3 días), pagos con problema, registros y accesos de 7 días, extracciones de 24 h, llamadas IA de 7 días, créditos consumidos en el mes y MRR estimado (suscripciones `active` normalizadas a mes).

`leadsCreatedMonth` / `leadsReusedMonth`: suma de `created` y `alreadyInDb` de las extracciones correctas del mes. Los reutilizados salieron de la base, sin llamar a Google Maps ni a INEGI. Es el "ahorro en búsquedas" de Inicio.

`attention` es la lista **Requiere atención** (máx. 25, por severidad):

| `reason` | Cuándo |
|---|---|
| `past_due`, `unpaid` | Estado vigente con problema de pago |
| `trial_expired` | Prueba terminada sin pasar a pago |
| `trial_ending` | Prueba que vence en ≤3 días |
| `no_credits` | Activa o en prueba y sin créditos este mes |
| `sync_failures` | 2+ extracciones fallidas en 7 días |
| `checkout_failed` | Intentos de pago fallidos en 7 días sin un pago correcto después |
| `inactive` | Plan activo y nadie del equipo entra hace 14 días |

Las empresas cuyos usuarios son todos `userTest` no cuentan en KPIs ni MRR.

### `adminCompanyInsights(companyId, days = 30)`

Métricas del 360 de una empresa en la ventana: por persona (accesos, último acceso, última acción, leads asignados, actividades, cotizaciones, extracciones, IA, WhatsApp, tours), pipeline por etapa, extracciones, créditos por día (hora de CDMX), IA por función, actividades por tipo, seguimientos pendientes/vencidos, propuestas y cotizaciones por estatus, WhatsApp y calendario.

Alcance del CRM (`crmCompanyScope`): el item cuenta para la empresa si su workspace es de la empresa o, sin workspace, si quien lo creó o lo tiene asignado es de la empresa. El lead solo no basta porque los leads se comparten entre empresas.

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

Filtros: `companyId`, `userId`, `types`, `onlyErrors`, `search`. Pagina por cursor: `before` = `occurredAt` del último item; `nextBefore` trae el siguiente. Cada fuente pide `take + 1` filas, se mezclan por fecha y se corta.

## Invariantes

- Nunca devolver prompts de IA, cuerpos de WhatsApp, contraseñas ni tokens.
- Fechas de calendario (`activatedAt`, `currentPeriodEnd`) como `YYYY-MM-DD`, igual que Keystone.
- El contrato GraphQL de `adminActivityFeed` no cambia cuando exista un modelo de eventos propio: solo cambia la fuente.

## Decisiones

### 2026-10-10 — Agregados en el back, no en el front

Operaciones necesitaba estado vigente por empresa, conteos por persona y un feed mezclado. Hacerlo con las listas de Keystone obligaba a bajar todas las suscripciones y logs al navegador. Se resuelve con Prisma en estas cuatro queries, solo para admin de plataforma.
