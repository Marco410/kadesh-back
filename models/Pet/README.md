# Pet

Dominio KadeshPet. Lists de adopción (`Animal`), mascotas del usuario con su cartilla (`Pet`, `PetOwner`, `PetHealthRecord`, `PetReminder`), directorio (`PetPlace`), tienda, anuncios y reseñas. El blog vive en `models/Blog` (compartido con el SaaS).

`Schedule` y `SocialMedia` viven aquí porque hoy solo cuelgan de `PetPlace`.

## Cartilla digital

`Pet` es la mascota de una familia; `PetOwner`, `PetHealthRecord` (+ `PetHealthRecordAttachment`) y `PetReminder` cuelgan de ella. Detalle, permisos, migración y ejemplos GraphQL en `docs/cartilla/README.md`.

Invariantes:
- Solo sus dueños (`PetOwner`) ven y cambian una mascota y todo lo suyo; un admin de plataforma ve todo (`Pet.access.ts`).
- Exactamente un `PetOwner` principal por mascota: se crea solo al registrarla y no se borra ni se cambia por API.
- `Pet.status` entra y sale de `lost` solo con `markPetAsLost` / `markPetAsFound`, que también amarran `Pet.lostReport` y `Animal.pet`.
- Al borrar una mascota se borran sus datos propios; reportes y citas se quedan con `pet` en null.

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
