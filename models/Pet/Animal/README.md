# Animal

List de animales del dominio Pet (perdidos, encontrados, adopción, etc.). El slug público alimenta URLs del front (`/animales/{slug}`).

## Invariantes

- El `slug` se genera en el create y no se regenera al editar el nombre.
- El primer `AnimalLog` puede enriquecer el slug con status/ciudad; logs posteriores no lo tocan.
- Al **crear** un Animal con session:
  - **Admin de plataforma** (`Role.ADMIN`) → publica en la Página de Facebook Pet (`FACEBOOK_PET_*`).
  - **Cualquier otro usuario** → correo a `SMTP_ADMIN_NOTIFICATION_EMAILS`.
  - **Sin session** (seed/scripts) → ni Facebook ni correo.
- Fallos de Facebook o correo se loguean; no abortan el create.

## Decisiones

### 2026-09-29 — Facebook (admin) + correo (no admin)

Qué: `animalCreateSideEffectsHook` en create genera el slug y luego ramifica por `isPlatformAdmin`. Link de Facebook: `{PET_FRONTEND_URL}/animales/{slug}`. Correo vía `sendAdminNewAnimalEmail`.

Por qué: los registros del admin se publican de inmediato en la Página Pet; los del resto avisan para revisión sin auto-postear.

Qué no hacer: no añadir `publishedToFacebookAt` (create dispara una sola vez); no publicar en Facebook SaaS; no re-disparar el side effect en el update del slug.
