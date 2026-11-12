# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kadesh backend: a [Keystone 6](https://keystonejs.com) CMS/API app (Node + TypeScript) backed by PostgreSQL via Prisma. Keystone generates the GraphQL API, admin UI, and Prisma schema from the list definitions in `models/`; custom queries/mutations are merged into the generated schema in `graphql/`.

## Commands

```
yarn dev                    # start Keystone dev server (admin UI + GraphQL API) on :3000
yarn build                  # production build
yarn start                  # run production build
yarn migrate                # HUMANO ONLY — never run by the agent. keystone prisma migrate dev after editing models
yarn migration:status       # HUMANO ONLY — never run by the agent
yarn db:seed                # run seed.ts (IS_BUILDING=true tsx seed.ts) against utils/seed/
```

There is no lint or test script configured in this repo.

Local Postgres for development is provided by `docker-compose.yml` (`docker compose up db`), configured via `config/.env.dev` (copy from `config/.env.template`). `env.ts` loads `config/.env.dev` via dotenv and is imported first in `keystone.ts`.

Required env vars (see `config/.env.template`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST`, `DB_PORT`, `GOOGLE_MAPS_API_KEY`, plus object storage (`S3_BUCKET_NAME`, `S3_REGION=auto`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Storage is Cloudflare R2 via Keystone's S3 adapter; missing keys fall back to local disk.

## Architecture

**Entry point**: `keystone.ts` builds the Keystone `config()`, wiring together `models/schema.ts` (lists), `auth/auth.ts` (session/auth), and `graphql/extendedSchema.ts` (custom GraphQL). Storage: `my_local_images` (local disk, `/images`) plus `s3_*` backends that target Cloudflare R2 when `S3_ENDPOINT` is set (signed URLs, 1h).

**Models** (`models/`): lists live under `models/Pet/` (KadeshPet), `models/Saas/` (CRM, billing, `Saas/Tech`), or the `models/` root if both products use them (`User`, `Role`). Register every list in `models/schema.ts`. Related sub-lists stay nested, e.g. `models/Pet/Animal/AnimalBreed/AnimalBreed.ts`, `models/Pet/PetPlace/PetPlaceLike/PetPlaceLike.ts`. Editing `models/schema.ts` or any list's fields changes the generated `schema.prisma` / `schema.graphql`. **Do not create or run Prisma migrations** — tell the human to run `yarn migrate` (or write the SQL under `migrations/` by hand).

Per-list conventions:
- `access` is a plain object/function passed to `list({ access, fields })`, usually imported from a colocated `<Name>.access.ts` (see `models/User/User.access.ts`) or a preset from `utils/access/presets.ts` (`adminOnlyAccess`, `publicReadAdminWriteAccess`, `anonymousCreateAccess`, `userRowAccess`, `viewRowAccess`). There is no open-access default anymore: never give a list `() => true` for update/delete.
- Field-level and input validation goes in a colocated `<Name>.hooks.ts` (e.g. `models/User/User.hooks.ts`, `models/TokenNotification/TokenNotification.hooks.ts`), exporting hook objects (`validateInput`, `resolveInput`) that are wired into the relevant `fields: { ... }` entries via Keystone's `hooks` field option.
- Enum-like values are plain TS `enum`s colocated with the model, e.g. `models/Role/constants.ts`.

**Auth** (`auth/`):
- `auth/auth.ts` sets up `@keystone-6/auth` (`withAuth`), keyed on `User.email`, with a stateless cookie session (`auth/auth.ts` session secret from `SESSION_SECRET`, falls back to a random one outside production). `sessionData` determines what's available on `context.session.data` in access/hooks.
- `auth/sessionGuards.ts` wraps the session strategy in `keystone.ts` (`withSessionGuards(withAuth(...))`): every request drops sessions whose `sessionVersion` changed, suspended users/companies, anonymized users, and expired "entrar como" tokens. `auth/impersonation.ts` is an Apollo plugin that blocks mutations for impersonation tokens. When a request sent a token that is no longer valid (revoked, suspended, anonymized, expired), `sessionEndedNoticePlugin` adds `extensions.session: { status, message }` to the response so the front sends the person to the login with that message. If you add fields it needs, add them to `sessionData` in `auth/auth.ts`.
- `auth/permissions.ts` provides `hasRole(session, allowedRoles)` and `validateAccess(session, roles)`. **`Role.ADMIN` always has every permission** — `hasRole` implicitly appends it to any allowed-roles list. List access files (e.g. `User.access.ts`) call `hasRole` inside `operation`/`filter`/`item` access functions.

**Custom GraphQL** (`graphql/`): Keystone's generated schema is extended, not replaced.
- `graphql/extendedSchema.ts` merges custom typeDefs/resolvers onto the base schema via `mergeSchemas`.
- `graphql/customs/mutations/index.ts` aggregates every custom mutation module's `{ typeDefs, definition, resolver }` into one object consumed by `extendedSchema.ts`.
- Each custom mutation is its own file (e.g. `nearbyPetPlaces.ts`, `importPetPlace.ts`, `auth/customAuth.ts`) exporting `{ typeDefs, definition, resolver }`: `typeDefs` declares any new GraphQL types/inputs plus a `type Mutation { ... }` block (for local type-checking/documentation), `definition` is just the mutation signature line reused in the merged `Mutation` type, and `resolver` is the resolver map entry. New custom mutations must follow this shape and be added to `graphql/customs/mutations/index.ts`.
- Custom resolvers commonly use `context.sudo().query.<List>.findOne/findMany/createOne/updateOne` to bypass access control for privileged operations (e.g. deduping/creating `PetPlace` records from external API data).
- Keystone's `context.prisma` **returns** Prisma errors as a `GraphQLError` value instead of throwing them. A failed `prisma.x.create()` or raw query does not throw: check `result instanceof Error` when it matters (`unwrapPrisma` / `optionalRead` in `graphql/customs/queries/admin/shared.ts`).

**Seeding** (`utils/seed/`): `seed.ts` (root) boots a Keystone context via `getContext` and runs `utils/seed/index.ts`, which composes per-entity seed files (`user.ts`, `animal_types.ts`, `pet_place_types.ts`, `veterinary.ts`, `veterinary_services.ts`).

**Shared utils** (`utils/`): `utils/constants/constants.ts` holds cross-cutting constant lists (e.g. `TYPES_PET_SHELTER`, used by both seed data and custom mutations); `utils/access/presets.ts` holds the reusable access rules (plus `forceSessionUser` to stamp the session user on create); `utils/helpers/` holds small helpers (e.g. `unike_link.ts` for generating unique usernames/slugs).

**Admin UI customization** (`admin/`): `admin/config.ts` registers custom Admin UI React components (`admin/components/`) like `CustomNavigation` and `CustomLogo`, wired into `keystone.ts`'s `ui` config.

**Activity log** (`models/ActivityEvent/`, `utils/activity/`): `ActivityEvent` records who changed what (CRM, team, plans, Stripe lifecycle, admin views, browser events via `trackEvents`). Lists in `models/schema.ts` are wrapped with `withActivityHooks`, which logs changes made by people (non-sudo context only). Server-side writes done with `context.sudo()` in custom mutations must call `logActivity` explicitly (fire-and-forget, never throws). Never log passwords, tokens, prompts or message bodies. See `models/ActivityEvent/README.md`. Failed GraphQL requests from signed-in people are logged as `app.error` by `utils/activity/appErrorsPlugin.ts` (operation name and message only, never variables). Pipeline stage changes are recorded for every write (also sudo) in `TechLeadStageChange` by the `TechStatusBusinessLead` hook; see its README.

**IA / Cerebro Kadesh** (`docs/ai/`): capa de IA a nivel `SaasCompany`. Cifrado en `utils/helpers/encryption.ts`, adapters en `utils/ai/`, mutaciones en `graphql/customs/mutations/ai/`. La IA managed consume los **mismos** créditos del periodo mensual (tokens → créditos, ver `docs/ai/precio-tokens.md`). Cada llamada queda en `TechAiCallLog`.

## Rendimiento y costo

Las reglas generales están en `~/.claude/CLAUDE.md` ("Rendimiento y costo de infraestructura"). Aquí va solo lo concreto de este repo. Si cambias uno de estos valores, actualiza esta sección en el mismo cambio.

### Utilidades que ya existen (reutilízalas, no escribas otra)

- **Pool de conexiones**: `keystone.ts` (`db.url`) lee `DB_CONNECTION_LIMIT` y `DB_POOL_TIMEOUT`. No armes otra URL de base en el servidor ni crees otro `PrismaClient`: usa `context.prisma` / `context.sudo()`.
- **Scripts**: copia la cabecera de `scripts/backfillLeadSearchNames.ts` (`connection_limit=2`, `$disconnect` en `finally`, modo reporte por defecto y `--apply` para guardar, par de scripts `x` / `x:prod` en `package.json`).
- **Búsqueda sin acentos**: `normalizeSearchText` en `utils/helpers/normalizeSearchText.ts`. El front usa la misma función. Ejemplo completo: `TechBusinessLead.businessNameSearch`, que mantiene el `resolveInput` de `models/Saas/Tech/BusinessLead/TechBusinessLead.hooks.ts`, con backfill `pnpm leads:backfill-search-names`.
- **Límites y deduplicación en memoria**: `createRateLimiter` y `createDeduper` en `utils/security/rateLimit.ts` (se barren solos). No uses un `Map` de módulo sin tope.
- **Caché de un valor con vigencia**: el patrón de `graphql/customs/queries/landingStats.ts` (`CACHE_MS` + un solo valor guardado).
- **Tope de `take`**: `clampInt` en `graphql/customs/queries/admin/shared.ts`, o una constante `MAX_TAKE` como en `graphql/customs/queries/petEvents.ts`.
- **Relaciones en lote**: `getLatestAnimalLogs` en `graphql/customs/queries/nearbyAnimals.ts` trae el último log de muchos animales en una consulta; es el modelo a seguir en vez de consultar por fila.
- **Descargas con tope de tamaño**: `downloadClickUpFile(url, maxBytes)` en `utils/intregrations/clickup.ts` corta el stream al pasar el límite.
- **URLs firmadas**: `getSignedStorageUrl` en `utils/intregrations/s3Storage.ts`.
- **Jobs programados**: un workflow de GitHub Actions que llama una mutación con `CRON_SECRET`, como `.github/workflows/send-pet-reminders.yml`. Nada de timers periódicos en el proceso.
- Los hooks del front (`useStableQuery`, pausa de polling con pestaña oculta) viven en kadesh-business, no aquí.

Dato de Keystone 6.5 que explica casi todos los N+1 de este repo: las relaciones **a-muchos** no se agrupan (un `findMany` por fila padre); las **a-uno** sí. Pedir `lista { relacionAMuchos { ... } }` sobre 500 filas son 500 consultas. Lo mismo un campo `virtual` que consulta la base.

### Valores vigentes

| Qué | Valor | Dónde |
|---|---|---|
| Pool de Prisma del servidor | 5 conexiones, espera 20 s (`connect_timeout=300`) | `keystone.ts`, variables `DB_CONNECTION_LIMIT` / `DB_POOL_TIMEOUT` |
| Pool de los scripts | 2 | `scripts/*.ts` |
| URLs firmadas de R2 | 1 h (3600 s) | `keystone.ts` (`s3Common.signed.expiry`) y `getSignedStorageUrl` |
| Sesión | 30 días; "entrar como" 1 h | `auth/auth.ts`, `auth/impersonation.ts` |
| Caché de `landingStats` | 6 h | `graphql/customs/queries/landingStats.ts` |
| Caché de `petLandingStats` | 1 h | `graphql/customs/queries/petLandingStats.ts` |
| Lista de IPs bloqueadas | se relee cada 60 s | `utils/security/blockedIps.ts` |
| Búsquedas de área de Google | 180 días | `utils/helpers/nearby_petplaces.ts` |
| Vistas de evento repetidas | 30 min | `models/Pet/PetEvent/constants.ts` |
| Errores y vistas de admin repetidos | 10 min | `utils/activity/appErrorsPlugin.ts`, `graphql/customs/mutations/activity/trackEvents.ts` |
| Subida de archivos / cuerpo JSON | 200 MB / 15 MB | `keystone.ts` |
| Imágenes que descarga el back | 8 MB | `utils/pet/petCard.ts`, `utils/clickup/postImage.ts` |
| Tope de filas | eventos 48, aliados 300, mensajes de la bandeja 500 | `petEvents.ts`, `rescueAllies.ts`, `whatsapp/whatsappConversations.ts` |
| Crons (GitHub Actions) | cada hora al minuto 5; diario 15:00 UTC | `.github/workflows/send-pet-event-notifications.yml`, `send-pet-reminders.yml` |

La revalidación de caché de los fronts debe quedar por debajo de 1 h, que es lo que duran las URLs firmadas.

Polling de los fronts que pega a este back (se define en los otros repos; valores al 2026-11-12):

| Qué | Intervalo | Dónde |
|---|---|---|
| Bandeja de WhatsApp | 15 s | kadesh-business `src/components/profile/whatsapp/WhatsAppChatsTab.tsx` |
| Chat abierto / su estado | 10 s / 60 s | kadesh-business `src/components/profile/whatsapp/WhatsAppChatPanel.tsx` |
| Campana de notificaciones | 3 min | kadesh-business `src/components/notifications/constants.ts` |
| No leídas (Kadesh Pet) | 5 min | kadesh-landing `src/components/notifications/constants.ts` |
| Heartbeat de actividad | 5 min | `usePanelActivity.ts` (business), `usePetActivity.ts` (landing) |

Cada petición con sesión cuesta 3 consultas antes del resolver (`sessionData` en `auth/auth.ts`: usuario, roles, empresa). Un poll nuevo las paga cada vez.

### Pendientes conocidos (no los empeores)

- **`getNearbyAnimals`** (`graphql/customs/queries/nearbyAnimals.ts`): trae todos los animales sin `take`, filtra estado, ubicación y distancia en memoria y pagina al final. Crece con la tabla.
- **Bandeja de WhatsApp** (`graphql/customs/queries/whatsapp/whatsappConversations.ts`): 500 mensajes con `businessLead { salesPerson }` → hasta 500 consultas extra por poll.
- **`nextFollowUpDate`** (`models/Saas/Tech/StatusBusinessLead/TechStatusBusinessLead.ts`): campo virtual con una consulta por fila. No lo pidas en listas largas.
- **Ninguna lista tiene `graphql.maxTake`**: el front puede pedir miles de leads en una petición.
- **Índices que faltan**: `TechBusinessLead.createdAt` (es el orden de todas las listas de leads) y `source`; `TechWhatsAppMessage (companyId, createdAt)`.
- **`adminCompanyInsights`** (`graphql/customs/queries/admin/adminCompanyInsights.ts`): un `count` por vendedor en `Promise.all` y un `take: 5000`. Con el pool en 5 se encolan; si aparece `P2024`, es aquí.
- **`salesVelocity`** (`utils/analytics/salesVelocity.ts`): carga todos los status de la empresa con su lead.
- **`findByPhone`** (`utils/whatsapp/matchPhone.ts`): `contains` sobre teléfono, hasta dos pasadas por mensaje entrante.
- **Archivos completos en memoria**: `downloadWhatsAppMedia` (`utils/intregrations/whatsapp.ts`) sin tope, y `sendWhatsAppMediaMessage.ts` hasta 200 MB.
- **Recibos de push** (`utils/notifications/push.ts`): `setTimeout` de 15 min; se pierde si el contenedor se duerme (Serverless de Railway).
- **Ciudad, estado y país de los leads**: sin normalizar ("Michoacán" / "Michoacan"). Pendiente una clave canónica como `PetEvent.cityKey`.

### Cómo comprobar que una feature no agrega carga

En la pestaña Red del front:
- Una acción de pantalla dispara una sola petición a `/api/graphql`, no una por tarjeta o fila.
- Con la pestaña oculta no sale ninguna petición repetida; al volver, una sola.
- Las listas mandan `take` y la respuesta no pesa más de unos cientos de KB.
- Al escribir en un buscador hay una petición por pausa, no por tecla.

En el back, en local:
- Pon temporalmente `enableLogging: ["query"]` en `db` de `keystone.ts` y cuenta las consultas de una sola petición. Si el número crece con las filas de la lista, hay N+1. No lo dejes en el commit.
- `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();` debe dar 6 o menos (5 del pool más tu sesión).
- Busca `P2024` en la consola: es una consulta que esperó más de 20 s por una conexión.
- Antes y después de usar la feature: `SELECT seq_scan, idx_scan FROM pg_stat_user_tables WHERE relname = 'TuTabla';`. Un salto de miles por una sola acción es la señal.

En producción: `pg_stat_statements` ordenado por `calls`, la RAM de Postgres y del servicio en Railway, y los errores en Actividad → Errores (`app.error`).

## Adding a new list

1. Create `models/Pet/<Name>/<Name>.ts`, `models/Saas/<Name>/<Name>.ts`, or `models/<Name>/<Name>.ts` (shared) exporting `list({ access, fields })` from `@keystone-6/core`.
2. Add access rules (reuse a preset from `utils/access/presets.ts` or write a `<Name>.access.ts` using `hasRole`/`Role`). Never leave update/delete open to anyone.
3. Register the list in `models/schema.ts`.
4. Stop. Tell the human to run `yarn migrate` (or write the migration SQL by hand). Never create files under `migrations/` or run migrate commands.
