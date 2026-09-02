# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kadesh backend: a [Keystone 6](https://keystonejs.com) CMS/API app (Node + TypeScript) backed by PostgreSQL via Prisma. Keystone generates the GraphQL API, admin UI, and Prisma schema from the list definitions in `models/`; custom queries/mutations are merged into the generated schema in `graphql/`.

## Commands

```
yarn dev                    # start Keystone dev server (admin UI + GraphQL API) on :3000
yarn build                  # production build
yarn start                  # run production build
yarn migrate                # keystone prisma migrate dev — create/apply a migration after editing models/schema.prisma changes
yarn migration:status       # check pending migrations
yarn db:seed                # run seed.ts (IS_BUILDING=true tsx seed.ts) against utils/seed/
```

There is no lint or test script configured in this repo.

Local Postgres for development is provided by `docker-compose.yml` (`docker compose up db`), configured via `config/.env.dev` (copy from `config/.env.template`). `env.ts` loads `config/.env.dev` via dotenv and is imported first in `keystone.ts`.

Required env vars (see `config/.env.template`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST`, `DB_PORT`, `GOOGLE_MAPS_API_KEY`, plus S3 storage config (`S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — `keystone.ts` throws at startup if any S3 var is missing).

## Architecture

**Entry point**: `keystone.ts` builds the Keystone `config()`, wiring together `models/schema.ts` (lists), `auth/auth.ts` (session/auth), and `graphql/extendedSchema.ts` (custom GraphQL). It also declares two file storage backends: `my_local_images` (local disk, served at `/images`) and `s3_files` (S3, signed URLs).

**Models** (`models/`): each Keystone list lives in its own file/folder under `models/<Name>/<Name>.ts`, and every list must be registered in `models/schema.ts` to be included in the schema. Related sub-lists are nested in folders, e.g. `models/Animal/AnimalBreed/AnimalBreed.ts`, `models/PetPlace/PetPlaceLike/PetPlaceLike.ts`, `models/Store/Product/Product.ts`. Editing `models/schema.ts` or any list's fields changes the generated `schema.prisma` / `schema.graphql` — run `yarn migrate` afterward to create a Prisma migration (migrations live in `migrations/`, one per named change).

Per-list conventions:
- `access` is a plain object/function passed to `list({ access, fields })`, usually imported from a colocated `<Name>.access.ts` (see `models/User/User.access.ts`) or the shared open-access default in `utils/generalAccess/access.ts`.
- Field-level and input validation goes in a colocated `<Name>.hooks.ts` (e.g. `models/User/User.hooks.ts`, `models/TokenNotification/TokenNotification.hooks.ts`), exporting hook objects (`validateInput`, `resolveInput`) that are wired into the relevant `fields: { ... }` entries via Keystone's `hooks` field option.
- Enum-like values are plain TS `enum`s colocated with the model, e.g. `models/Role/constants.ts`.

**Auth** (`auth/`):
- `auth/auth.ts` sets up `@keystone-6/auth` (`withAuth`), keyed on `User.email`, with a stateless cookie session (`auth/auth.ts` session secret from `SESSION_SECRET`, falls back to a random one outside production). `sessionData` determines what's available on `context.session.data` in access/hooks.
- `auth/permissions.ts` provides `hasRole(session, allowedRoles)` and `validateAccess(session, roles)`. **`Role.ADMIN` always has every permission** — `hasRole` implicitly appends it to any allowed-roles list. List access files (e.g. `User.access.ts`) call `hasRole` inside `operation`/`filter`/`item` access functions.

**Custom GraphQL** (`graphql/`): Keystone's generated schema is extended, not replaced.
- `graphql/extendedSchema.ts` merges custom typeDefs/resolvers onto the base schema via `mergeSchemas`.
- `graphql/customs/mutations/index.ts` aggregates every custom mutation module's `{ typeDefs, definition, resolver }` into one object consumed by `extendedSchema.ts`.
- Each custom mutation is its own file (e.g. `nearbyPetPlaces.ts`, `importPetPlace.ts`, `auth/customAuth.ts`) exporting `{ typeDefs, definition, resolver }`: `typeDefs` declares any new GraphQL types/inputs plus a `type Mutation { ... }` block (for local type-checking/documentation), `definition` is just the mutation signature line reused in the merged `Mutation` type, and `resolver` is the resolver map entry. New custom mutations must follow this shape and be added to `graphql/customs/mutations/index.ts`.
- Custom resolvers commonly use `context.sudo().query.<List>.findOne/findMany/createOne/updateOne` to bypass access control for privileged operations (e.g. deduping/creating `PetPlace` records from external API data).

**Seeding** (`utils/seed/`): `seed.ts` (root) boots a Keystone context via `getContext` and runs `utils/seed/index.ts`, which composes per-entity seed files (`user.ts`, `animal_types.ts`, `pet_place_types.ts`, `veterinary.ts`, `veterinary_services.ts`).

**Shared utils** (`utils/`): `utils/constants/constants.ts` holds cross-cutting constant lists (e.g. `TYPES_PET_SHELTER`, used by both seed data and custom mutations); `utils/generalAccess/access.ts` is the default open-access policy for lists with no custom access rules; `utils/helpers/` holds small helpers (e.g. `unike_link.ts` for generating unique usernames/slugs).

**Admin UI customization** (`admin/`): `admin/config.ts` registers custom Admin UI React components (`admin/components/`) like `CustomNavigation` and `CustomLogo`, wired into `keystone.ts`'s `ui` config.

## Adding a new list

1. Create `models/<Name>/<Name>.ts` exporting `list({ access, fields })` from `@keystone-6/core`.
2. Add access rules (reuse `utils/generalAccess/access.ts` or write a `<Name>.access.ts` using `hasRole`/`Role`).
3. Register the list in `models/schema.ts`.
4. Run `yarn migrate` to generate the Prisma migration and regenerate `schema.prisma`/`schema.graphql`.
