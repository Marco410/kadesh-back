# ActivityEvent

Registro propio de **qué hizo quién** en la plataforma. Sirve para auditar (incluido lo que hace el admin de Kadesh con datos de clientes), para operar (riesgo de baja, intención de compra) y, más adelante, para analítica agregada.

Complementa los logs que ya existían; no los reemplaza ni los copia.

## Qué va aquí y qué no

| Hecho | Dónde vive | Por qué |
| --- | --- | --- |
| Logins, registros, fallos de acceso | `UserAuthLog` (ahora con IP y navegador) | Ya existía y lo escribe el servidor |
| Extracciones | `TechLeadSyncLog` | Ya existía |
| Llamadas a IA | `TechAiCallLog` | Ya existía (con prompts, que aquí nunca se guardan) |
| Altas de créditos, consumo | `SaasCompanyCreditLedger` | Ya existía |
| Intentos de checkout, cobros | `SaasSubscriptionLog`, `SaasPayment` | Ya existían |
| WhatsApp enviados | `TechWhatsAppMessage` | Ya existía |
| Alta de actividades, propuestas y cotizaciones (+ enviada/aceptada) | Sus propias tablas (`createdBy`, `sentAt`, `acceptedAt`) | Ya tienen fecha y autor |
| **Cambios hechos por personas** (mover un lead, asignar vendedor, roles, permisos, ajustar un plan…) | `ActivityEvent` | No dejaban rastro |
| **Ciclo de cobro de Stripe** (renovación, fallo, cancelación, reembolso) | `ActivityEvent` + `SaasPayment` | No había webhook |
| **Navegación** (secciones, módulos bloqueados, clic en mejorar plan, tours, exportaciones, salida) | `ActivityEvent` (lo manda el front) | Solo lo sabe el navegador |
| **Qué abre el admin de Kadesh** (360, ficha de persona, conversación de IA) | `ActivityEvent` | Auditoría del admin |
| Tiempo con el panel abierto | `UserActivityDay` (una fila por persona y día) | Ver `models/User/UserActivityDay` |

El feed de Operaciones (`adminActivityFeed`) une todas esas fuentes. Para que ningún hecho salga dos veces, `FEED_HIDDEN_EVENT_TYPES` lista los tipos que se guardan aquí pero que el feed ya muestra desde su tabla (cotización enviada/aceptada, cobro fallido o reembolsado).

## Campos

- `type`: texto (`lead.status_changed`). El catálogo vive en `constants.ts` (`ACTIVITY_EVENT`) para agregar tipos sin migrar.
- `category`: sale del prefijo del tipo (`categoryForType`) y es el filtro del feed: `auth`, `extraction`, `crm`, `team`, `ai`, `credits`, `billing`, `whatsapp`, `calendar`, `admin`, `product` (navegación).
- `actor`, `company`, `workspace`: relaciones de **un solo lado** (no agregan campos a `User`, `SaasCompany` ni `SaasWorkspace`). Al borrar al actor o a la empresa, el evento queda con `null`.
- `entityType` / `entityId`: el item afectado (`TechBusinessLead`, `SaasQuotation`, `User`…).
- `summary`: frase en español lista para mostrar.
- `metadata`: `{ from, to }`, `{ changes: { campo: [antes, después] } }`, conteos, montos.
- `source`: `web` (persona en el panel), `admin` (admin de Kadesh sobre datos de otra empresa), `webhook` (Stripe), `system` (servidor sin persona).
- `success` / `errorMessage`, `ip`, `userAgent`, `createdAt`.

## Cómo se escribe

Nunca por API (`create`/`update` = false). Solo el servidor, con `utils/activity/logActivity.ts`:

- No lanza: si falla el registro, la operación del usuario sigue.
- Escribe con Prisma (sudo), sin hooks ni access.
- Limpia `metadata` (`scrubMetadata`): oculta llaves como `password`, `token`, `apiKey`, `prompt`, `body`; recorta textos y arreglos.
- Toma IP (`x-forwarded-for` del proxy si existe) y navegador de `context.req`.

Tres caminos:

1. **Hooks de lists** (`utils/activity/listActivityHooks.ts`, aplicado en `models/schema.ts` con `withActivityHooks`). Registran el antes y el después de lo que una **persona** cambia con las mutaciones generadas (panel o Admin UI). Solo corren con contexto **no sudo** y con sesión.
2. **Llamadas explícitas** en mutaciones custom que escriben con sudo: `addOwnLead`, `promoteInegiEstablishmentToLead`, `sendAdminBroadcastEmail`, `updatePlanFeatureCatalog`, conectar/desconectar Google Calendar, ajustes de IA y de WhatsApp, asignar/enlazar/importar chats de WhatsApp, créditos agotados (`utils/saas/companyCredits.ts`), y el estado de suscripciones (`utils/saas/stripeSubscriptionSync.ts`).
3. **`trackEvents`** (`graphql/customs/mutations/activity/trackEvents.ts`): lo que solo sabe el navegador. Lista cerrada de tipos (`CLIENT_EVENT_TYPES`; los `admin.*` solo para admin de plataforma). El servidor pone actor y empresa.

## Lists con hooks

| List | Qué registra |
| --- | --- |
| `TechStatusBusinessLead` | Etapa del pipeline (de → a), oportunidad, datos de seguimiento, quitar del CRM. La asignación ya no se registra aquí (el estatus es de la empresa), sino desde `TechBusinessLead` |
| `TechBusinessLead` | Vendedores conectados/desconectados, campos editados (solo nombres), borrado |
| `SaasQuotation` | Cambio de estatus (`quotation.sent/accepted/rejected/expired/reopened`), borrado |
| `TechProposal` | Estatus, aprobada, pagada, columna del tablero, borrado |
| `SaasProject` | Alta, estatus, borrado |
| `TechFollowUpTask` | Alta, estatus, columna, borrado |
| `TechTask`, `TechSalesActivity` | Alta (tarea), columna del tablero, borrado |
| `TechFile` | Archivo subido o borrado |
| `SaasWorkspace` | Alta, miembros agregados/quitados, borrado |
| `User` | Alta hecha por otra persona, roles (antes → después), permisos, empresa, perfil editado por otra persona, borrado |
| `SaasCompany` | Datos de la empresa editados (solo nombres de campos) |
| `SaasCompanySubscription`, `SaasPlan`, `SaasCredit` | Cambios del admin (`admin.*`) con antes → después |

## Invariantes

- Nunca guardar contraseñas, tokens, llaves, prompts, respuestas de IA, cuerpos de WhatsApp o correos, ni teléfonos de contactos.
- Los textos de leads solo aparecen en `summary` (nombre del negocio, dato público de Google o INEGI); `metadata` no los copia.
- Un fallo del registro jamás rompe la operación.
- Antes de correr la migración, el feed y los insights siguen funcionando: sus lecturas de esta tabla van en `try/catch`.

## Agregar un evento

1. Agrega el tipo en `ACTIVITY_EVENT` (y en `CATEGORY_BY_PREFIX` si es un prefijo nuevo).
2. Si lo dispara una persona con una mutación generada, agrégalo al tracker de su list. Si lo dispara una mutación custom, llama `logActivity` sin `await` (`void logActivity(...)`).
3. Si lo manda el front, agrégalo a `CLIENT_EVENT_TYPES` y a `TRACK_EVENT` en `kadesh-business/src/utils/activity/track.ts`.
4. Si el feed ya lo muestra desde otra tabla, agrégalo a `FEED_HIDDEN_EVENT_TYPES`.

## Retención

`pnpm activity:prune` (reporte) y `pnpm activity:prune --apply` borran eventos de más de 13 meses (`ACTIVITY_RETENTION_MONTHS`). Correrlo una vez al mes.

## Decisiones

### 2026-10-10 — Complementa los logs, sin copiar el historial

Qué: los logs que ya existían siguen siendo la fuente de sus hechos. `ActivityEvent` guarda solo lo que no tenía registro. El feed une ambas fuentes y el contrato de `adminActivityFeed` no cambió.

Por qué: el plan original copiaba todo el historial a esta tabla (backfill) y dejaba una sola fuente. Habría duplicado datos que ya tienen su tabla y su autor, y obligado a mantener dos copias sincronizadas. Así no hace falta backfill y el feed funciona igual antes y después de migrar.

Qué no hacer: no registrar aquí altas que ya tienen tabla (actividades, propuestas, cotizaciones, extracciones, IA). Si hace falta para analítica, regístralo y agrégalo a `FEED_HIDDEN_EVENT_TYPES`.

### 2026-10-10 — Los hooks solo registran a personas (contexto no sudo)

Qué: `withActivityHooks` ignora las escrituras hechas con `context.sudo()`.

Por qué: una extracción crea o liga cientos de leads con sudo; registrar cada alta llenaría la tabla de ruido que `TechLeadSyncLog` ya resume. Lo que el servidor hace a nombre de alguien se registra con un evento explícito y con un resumen útil.

Cómo se distingue: el contexto sudo usa otro schema GraphQL (`context.graphql.schema === context.sudo().graphql.schema`).

### 2026-10-10 — El tiempo activo se suma por día, no un evento por latido

Qué: el latido del front (cada 5 min con la pestaña visible) no crea filas aquí; suma minutos en `UserActivityDay`.

Por qué: un evento por latido serían ~12 filas por hora por persona. Con una fila por día la tabla queda chica, salen directos los usuarios activos (DAU/WAU/MAU) y el "visto por última vez", y `ActivityEvent` sigue siendo solo de inserción.
