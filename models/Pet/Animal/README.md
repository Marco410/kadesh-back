# Animal

List de animales del dominio Pet (perdidos, encontrados, adopción, etc.). El slug público alimenta URLs del front (`/animales/{slug}`).

## Invariantes

- **Acceso** (`Animal.access.ts`): la ficha, sus bitácoras y fotos son públicas para leer. Crear exige sesión; editar y borrar, ser el dueño (`Animal.user`) o admin de plataforma. Un usuario normal siempre queda como dueño de lo que crea. Crear una bitácora o foto exige ser dueño del animal destino (`validateInput`). Lo que hace el servidor con `sudo()` no pasa por estas reglas. Comentarios y favoritos: lectura pública, crear con sesión y siempre a nombre propio, borrar el autor o un admin, editar solo un admin. Vistas: se registran también sin sesión (nunca a nombre de otra persona), nadie las edita y solo un admin las borra; la lectura sigue pública porque `animal_viewsCount` pasa por ese acceso.
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

### 2026-10-13 — Solo el dueño o un admin cambian un animal

Qué: `Animal`, `AnimalLog`, `AnimalMultimedia`, `AnimalComment`, `AnimalFavorite` y `AnimalView` dejan el acceso abierto genérico (`utils/generalAccess/access.ts`) por `Animal.access.ts`: lectura pública; crear con sesión; editar y borrar el dueño o un admin de plataforma; bitácoras y fotos nuevas solo sobre animales propios; comentarios, favoritos y vistas quedan a nombre de la sesión (el cliente ya no firma por otra persona) y solo el autor o un admin los borra.

Por qué: con el acceso abierto, cualquiera —incluso sin sesión— podía editar o borrar cualquier animal por API; solo lo frenaba la pantalla de kadesh-landing. Es el primer paso de la fase 1 de Kadesh Pet en Operaciones (el admin edita desde el mismo formulario de kadesh-landing).

Qué no hacer: no volver a `generalAccess` en estas lists; no validar dueño en escrituras `sudo()` (reportes del servidor, semillas).
