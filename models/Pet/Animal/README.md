# Animal

List de animales del dominio Pet (perdidos, encontrados, adopción, etc.). El slug público alimenta URLs del front (`/animales/{slug}`).

## Invariantes

- El `slug` se genera en el create y no se regenera al editar el nombre.
- El primer `AnimalLog` puede enriquecer el slug con status/ciudad; logs posteriores no lo tocan.
- Al **crear** un Animal con session:
  - **Admin de plataforma** (`Role.ADMIN`) → publica en la Página de Facebook Pet (`FACEBOOK_PET_*`) cuando el slug ya es el del primer log y la portada, si hay fotos, ya está guardada. Si log y fotos vienen en el mismo `create`, publica al terminar ese `create`. Si no hay fotos, publica a los 90 s del primer log. Link: `{PET_FRONTEND_URL}/animales/{slug}`.
  - **Cualquier otro usuario** → correo a `SMTP_ADMIN_NOTIFICATION_EMAILS`.
  - **Sin session** (seed/scripts) → ni Facebook ni correo.
- Fallos de Facebook o correo se loguean; no abortan el create.
- La espera de Facebook vive en el proceso que creó el animal. Si ese proceso se reinicia antes de publicar, ese animal no sale en la Página.

## Decisiones

### 2026-09-29 — Facebook (admin) + correo (no admin)

Qué: `animalCreateSideEffectsHook` en create genera el slug y luego ramifica por `isPlatformAdmin`. Link de Facebook: `{PET_FRONTEND_URL}/animales/{slug}`. Correo vía `sendAdminNewAnimalEmail`.

Por qué: los registros del admin se publican de inmediato en la Página Pet; los del resto avisan para revisión sin auto-postear.

Qué no hacer: no añadir `publishedToFacebookAt` (create dispara una sola vez); no publicar en Facebook SaaS; no re-disparar el side effect en el update del slug.

### 2026-10-01 — Facebook después del slug y de la portada

Qué: el formulario crea el animal, después el log (el slug puede ganar status y ciudad) y al final las fotos. Publicar en el `create` mandaba `/animales/{slug}` de antes del log, y Facebook cacheaba la tarjeta Open Graph sin foto.

El admin deja el animal en espera. El primer log reinicia esa espera. Cada `AnimalMultimedia` nuevo, si el animal sigue en espera, publica 2.5 s después de la última foto. Si en el mismo `create` ya vienen log y portada (Admin de Keystone), se publica ahí mismo. Un slug que el log ya escribió no se regenera.

Qué no hacer: no publicar en el `create` del formulario público; no volver a publicar si llegan fotos cuando la espera ya terminó.
