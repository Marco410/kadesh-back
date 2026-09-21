# Pet

Dominio KadeshPet. Lists de adopción (`Animal`), mascotas del usuario (`Pet`), directorio (`PetPlace`), tienda, anuncios y reseñas. El blog vive en `models/Blog` (compartido con el SaaS).

`Schedule` y `SocialMedia` viven aquí porque hoy solo cuelgan de `PetPlace`.

## Decisiones

### 2026-09-17 — dominio bajo `models/Pet`

Qué: Animal, PetPlace, tienda, blog, ads y reseñas pasaron a esta carpeta.

Qué no hacer: no mezclar lists de CRM/créditos aquí.

## Qué no va aquí

Cuentas y roles (`User`, `Role`). CRM, planes y créditos (`Saas/`).
