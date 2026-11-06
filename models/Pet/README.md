# Pet

Dominio KadeshPet. Lists de adopción (`Animal`), mascotas del usuario con su cartilla (`Pet`, `PetOwner`, `PetHealthRecord`, `PetReminder`), directorio (`PetPlace`), tienda, anuncios y reseñas. El blog vive en `models/Blog` (compartido con el SaaS).

`Schedule` y `SocialMedia` viven aquí porque hoy solo cuelgan de `PetPlace`.

## Cartilla digital

`Pet` es la mascota de una familia; `PetOwner`, `PetHealthRecord` (+ `PetHealthRecordAttachment`) y `PetReminder` cuelgan de ella. Detalle, permisos, migración y ejemplos GraphQL en `docs/cartilla/README.md`.

Invariantes:
- Solo sus dueños (`PetOwner`) ven y cambian una mascota y todo lo suyo, o el equipo del espacio de rescate si es su ficha; un admin de plataforma ve todo (`Pet.access.ts`).
- Exactamente un `PetOwner` principal por mascota: se crea solo al registrarla y no se borra ni se cambia por API. La excepción es la ficha de un espacio de rescate (`Pet.organization`): no tiene dueños hasta que `completeRescueAdoption` pone al adoptante como principal.
- `Pet.status` entra y sale de `lost` solo con `markPetAsLost` / `markPetAsFound`, que también amarran `Pet.lostReport` y `Animal.pet`.
- Al borrar una mascota se borran sus datos propios; reportes y citas se quedan con `pet` en null.
- Una mascota solo cambia de cuenta con un código de traspaso (`PetTransfer`) o al completar una adopción (`completeRescueAdoption`, `completeAdoptionApplication`). Todas pasan por `utils/pet/petTransfer.ts`, y el código sin usar se cancela si cambia de manos por otra vía.
- Las solicitudes de adopción (`AdoptionApplication`, en `Animal/`) son de un reporte «En adopción»; al encontrar familia se cierran todas (`utils/pet/adoptionApplications.ts`).

## Eventos

`PetEvent` (+ `PetEventSession`, `PetEventMultimedia`, `PetEventInterest`): campañas y jornadas que publica la comunidad, con revisión de un admin y avisos por zona. Detalle en `PetEvent/README.md`.

## Decisiones

### 2026-10-23 — Cartilla digital sobre la `Pet` existente

Qué: se extendió `Pet` (no se creó otra list) y se agregaron `PetOwner`, `PetHealthRecord`, `PetHealthRecordAttachment` y `PetReminder`. Especie y raza siguen siendo `animal_type`/`animal_breed` y las fotos `PetMultimedia` (`s3_pets`). `Pet.user` se reemplazó por `PetOwner` principal (backfill en la migración). `Pet` y `PetMultimedia` dejaron el acceso abierto genérico.

Por qué: `Pet` existía sin uso en web ni móvil. Reusar `AnimalType`/`AnimalBreed` deja que `markPetAsLost` pase los datos tal cual a un `Animal`. El prefijo `Pet` evita choques con el SaaS en un backend compartido.

Qué no hacer: no volver a `generalAccess` en estas lists; no cambiar `Pet.status` desde/hacia `lost` por fuera de las mutaciones; no crear un "species" propio de la cartilla.

### 2026-09-17 — dominio bajo `models/Pet`

Qué: Animal, PetPlace, tienda, blog, ads y reseñas pasaron a esta carpeta.

Qué no hacer: no mezclar lists de CRM/créditos aquí.

## Qué no va aquí

Cuentas y roles (`User`, `Role`). CRM, planes y créditos (`Saas/`).
