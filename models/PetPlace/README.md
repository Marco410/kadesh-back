# Veterinarias (PetPlace)

Directorio de clínicas. La ficha pública se reclama; un admin la verifica antes de que el dueño edite.

## Contacto público

Teléfono, WhatsApp, sitio y correo van en `PetPlace`. Estacionamiento y cita previa también (`parking`, `appointmentRequired`), junto a `emergencies`.

Las redes **no** son columnas de la clínica. Viven en `SocialMedia` (`pet_place_social_media`: Facebook, Instagram, X, LinkedIn, TikTok). El dueño las reemplaza juntas desde `updateMyPetPlace.socialMedia`.

## URL

La ficha pública vive en `/veterinarias/{slug}`. El slug es `nombre-municipio` (si hay colisión, `-2`, `-3`). Se genera al crear y **no cambia** si el dueño edita el nombre. Si una ficha vieja no tiene slug, se escribe al leerla (ficha o directorio). Los CUID viejos siguen resolviendo y el front redirige al slug. Backfill masivo: `pnpm tsx utils/seed/backfill_pet_place_slugs.ts`.

## Reclamo

Ver [`graphql/customs/mutations/pet/veterinary/README.md`](../../graphql/customs/mutations/pet/veterinary/README.md). En Keystone: columnas `claimStatus` y `verified`. Marcar `verified` sincroniza el estado a verificada.

## Agenda

Citas/reservas de clientes: ver [`PetPlaceAppointment/README.md`](./PetPlaceAppointment/README.md). No confundir con `Schedule` (horario semanal de apertura, campo `pet_place_schedules`); las citas están en `pet_place_appointments`.

## Qué no va aquí

Importación masiva desde Places (`executeImportPetPlace`). Servicios del catálogo (`PetPlaceService`).
