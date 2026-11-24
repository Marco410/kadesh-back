# Veterinarias (PetPlace)

Directorio de clínicas. La ficha pública se reclama; un admin la verifica antes de que el dueño edite.

## Contacto público

Teléfono, WhatsApp, sitio y correo van en `PetPlace`. Estacionamiento y cita previa también (`parking`, `appointmentRequired`), junto a `emergencies`.

Las redes **no** son columnas de la clínica. Viven en `SocialMedia` (`pet_place_social_media`: Facebook, Instagram, X, LinkedIn, TikTok). El dueño las reemplaza juntas desde `updateMyPetPlace.socialMedia`. Tipos (`types`, al menos uno; valores de `TYPES_PET_SHELTER`). Si el dueño marca uno que aún no existe en `PetPlaceType` (el seed se saltaba tipos nuevos si ya había alguno), `updateMyPetPlace` lo crea. Servicios del catálogo (`serviceIds`) y horario semanal (`schedules` → `pet_place_schedules`) salen por la misma mutación. Pacientes (`patients` → `User.clinic_patients_of`): los da de alta el dueño verificado con `createPetPlacePatient` (crea un `User` o liga uno existente por correo).

## URL

La ficha pública vive en `/veterinarias/{slug}`. El slug es `nombre-municipio` (si hay colisión, `-2`, `-3`). Se genera al crear y **no cambia** si el dueño edita el nombre. Si una ficha vieja no tiene slug, se escribe al leerla (ficha o directorio). Los CUID viejos siguen resolviendo y el front redirige al slug. Backfill masivo: `pnpm tsx utils/seed/backfill_pet_place_slugs.ts`.

## Reclamo

Ver [`graphql/customs/mutations/pet/veterinary/README.md`](../../../graphql/customs/mutations/pet/veterinary/README.md). En Keystone: columnas `claimStatus` y `verified`. Marcar `verified` sincroniza el estado a verificada.

## Agenda

Citas/reservas: ver [`PetPlaceAppointment/README.md`](./PetPlaceAppointment/README.md). El dueño verificado también agenda para un paciente de su lista (`createClinicAppointment`). No confundir con `Schedule` (horario semanal de apertura, campo `pet_place_schedules`).

## Acceso

`PetPlace.access.ts`:
- Leer: público (directorio, ficha y SEO).
- Crear: con sesión. `petPlaceResolveInput` (`PetPlace.hooks.ts`) la deja a nombre de quien la crea, `claimStatus: pending` y `claimedAt` ahora.
- Editar y borrar: solo admin. El dueño edita con `updateMyPetPlace` y reclama con `claimPetPlace` (sudo).
- Campos del reclamo (`claimPhone`, `claimNotes`, `claimRole`, `claimedAt`): los leen el dueño o el admin; solo el admin filtra u ordena por ellos.
- `pipelineStatus`: solo admin.
- Verificación, slug, `views`, campos de Google y relaciones (`services`, `patients`, `pet_place_*`): solo el admin los manda al crear.

## Vistas

`views` cuenta quién abre la página de la ficha. La suma `recordPetPlaceView` (sudo, SQL directo), que el landing llama una vez al abrirla:

- Una por persona (o IP + navegador sin sesión) y ficha cada 30 min (`PET_PLACE_VIEW_DEDUPE_MS` en `const.ts`).
- No cuentan el dueño de la ficha, los admins ni los bots conocidos.
- Al público el número se le devuelve solo desde 10 vistas (`PET_PLACE_VIEWS_PUBLIC_MIN`); al dueño y al admin siempre.
- Empezó a contar el 2026-11-23: las fichas viejas tienen `views` vacío o en 0.
- En Operaciones → Kadesh Pet → Resumen → Veterinarias: «Más vistas» (`adminPetSummary.places.topViewed` y `places.views`), de siempre.

## Qué no va aquí

Importación masiva desde Places (`executeImportPetPlace`). El catálogo de servicios es [`PetPlaceService/README.md`](./PetPlaceService/README.md).
