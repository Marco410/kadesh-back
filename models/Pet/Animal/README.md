# Animal

List de animales del dominio Pet (perdidos, encontrados, adopción, etc.). El slug público alimenta URLs del front (`/animales/{slug}`).

## Invariantes

- **Acceso** (`Animal.access.ts`): la ficha, sus bitácoras y fotos son públicas para leer. Crear exige sesión; editar y borrar, ser el dueño (`Animal.user`) o admin de plataforma. Un usuario normal siempre queda como dueño de lo que crea. Crear una bitácora o foto exige ser dueño del animal destino (`validateInput`). Lo que hace el servidor con `sudo()` no pasa por estas reglas. Comentarios y favoritos: lectura pública, crear con sesión y siempre a nombre propio, borrar el autor o un admin, editar solo un admin. Vistas: se registran también sin sesión (nunca a nombre de otra persona), nadie las edita y solo un admin las borra; la lectura sigue pública porque `animal_viewsCount` pasa por ese acceso.
- El `slug` se genera en el create y no se regenera al editar el nombre.
- El primer `AnimalLog` puede enriquecer el slug con status/ciudad; logs posteriores no lo tocan.
- Al **crear** un Animal con session:
  - **Admin de plataforma** (`Role.ADMIN`) → publica en la Página de Facebook Pet (`FACEBOOK_PET_*`) cuando el slug ya es el del primer log y la portada, si hay fotos, ya está guardada. Si log y fotos vienen en el mismo `create`, publica al terminar ese `create`. Si no hay fotos, publica a los 90 s del primer log. Link: `{PET_FRONTEND_URL}/animales/{slug}`.
  - **Cualquier otro usuario** → notificación a los admins en la campana de Operaciones (`animal.created`). El correo a `SMTP_ADMIN_NOTIFICATION_EMAILS` solo sale con `ADMIN_NOTIFICATION_EMAILS=on`.
  - **Sin session** (seed/scripts) → ni Facebook ni correo.
- Fallos de Facebook o correo se loguean; no abortan el create.
- La espera de Facebook vive en el proceso que creó el animal. Si ese proceso se reinicia antes de publicar, ese animal no sale en la Página.
- **Reportes parecidos** (`findSimilarReports` en `utils/pet/animalReport.ts`, puntaje en `utils/pet/reportSimilarity.ts`): junta candidatos del mismo tipo por enlace, teléfono y registros a 5 km o menos (90 días si está perdido, 30 si no). Los descarta si están cerrados (`in_family`, `adopted`) o unidos a otro (`duplicateOf`). Califica nombre, distancia, sexo, color, raza, señas y fecha. Desde 45 puntos es `possible` y desde 70 `likely`. `kind: duplicate` es el mismo animal con el mismo estatus. `kind: match` es el otro lado (perdido ↔ encontrado, rescatado o abandonado). `findAnimalReportDuplicates` lo expone sin teléfonos. `createAnimalReport` solo bloquea un `duplicate` fuerte (`isStrongDuplicate`).
- **Comentarios** (`AnimalComment.kind`: `comment`, `duplicate_report` o `possible_match`): cada comentario avisa a quien atiende el reporte, salvo que lo escriba esa misma persona. En reportes de la automatización (`PET_AUTOMATION_USER_ID`) o sin autor, solo los `duplicate_report` y `possible_match` avisan a los admins.
- **Solicitudes para quedarse con el reporte** (`AnimalClaim`):
  - Las crea con sesión quien dice que es su mascota, con mensaje, teléfono y foto opcional. Siempre quedan a su nombre y `pending`.
  - Las ven quien las hizo, quien atiende o atendía el reporte, y un admin.
  - Las responde quien atiende el reporte con `resolveAnimalClaim`; si es la automatización, solo un admin. `cancelAnimalClaim` lo usa quien la hizo.
  - Al aprobar, `Animal.user` pasa a quien reclamó, `reportedBy: owner`, y su teléfono queda como principal (el anterior, de segundo si estaba libre). Las demás pendientes se rechazan.
  - Máximo 3 por persona en 24 h, una pendiente por reporte, y no se puede reclamar un reporte propio ni uno unido a otro.
- **Unir repetidos** (`duplicateOf`, solo admin, en `Animal.merge.ts`):
  - Al ponerlo, los comentarios y favoritos pasan al principal y los repetidos de este repetido también apuntan al principal.
  - Se rechazan sus solicitudes pendientes.
  - Queda un comentario `duplicate_report` en el principal y se avisa `animal.merged` a quien hizo el repetido.
  - `getNearbyAnimals` ya no lo lista y la web redirige su ficha al principal (308).
- `duplicateCheck` (JSON, solo admin lo lee): los parecidos que la persona descartó al publicar, para decidir si unirlos.
- Con el primer registro de un perdido o encontrado, además de la alerta de zona, `notifyPossibleMatches` avisa a quien atiende hasta 3 reportes `match` `likely` (`animal.possible_match`, una vez por reporte y destinatario).

## Decisiones

### 2026-09-29 — Facebook (admin) + correo (no admin)

Qué: `animalCreateSideEffectsHook` en create genera el slug y luego ramifica por `isPlatformAdmin`. Link de Facebook: `{PET_FRONTEND_URL}/animales/{slug}`. Correo vía `sendAdminNewAnimalEmail`.

Por qué: los registros del admin se publican de inmediato en la Página Pet; los del resto avisan para revisión sin auto-postear.

Qué no hacer: no publicar en Facebook SaaS; no re-disparar el side effect en el update del slug. (La prohibición de guardar la fecha de publicación se revirtió el 2026-10-14, ver abajo.)

### 2026-10-01 — Facebook después del slug y de la portada

Qué: el formulario crea el animal, después el log (el slug puede ganar status y ciudad) y al final las fotos. Publicar en el `create` mandaba `/animales/{slug}` de antes del log, y Facebook cacheaba la tarjeta Open Graph sin foto.

El admin deja el animal en espera. El primer log reinicia esa espera. Cada `AnimalMultimedia` nuevo, si el animal sigue en espera, publica 2.5 s después de la última foto. Si en el mismo `create` ya vienen log y portada (Admin de Keystone), se publica ahí mismo. Un slug que el log ya escribió no se regenera.

Qué no hacer: no publicar en el `create` del formulario público; no volver a publicar si llegan fotos cuando la espera ya terminó.

### 2026-10-13 — Solo el dueño o un admin cambian un animal

Qué: `Animal`, `AnimalLog`, `AnimalMultimedia`, `AnimalComment`, `AnimalFavorite` y `AnimalView` dejan el acceso abierto genérico (`utils/generalAccess/access.ts`) por `Animal.access.ts`: lectura pública; crear con sesión; editar y borrar el dueño o un admin de plataforma; bitácoras y fotos nuevas solo sobre animales propios; comentarios, favoritos y vistas quedan a nombre de la sesión (el cliente ya no firma por otra persona) y solo el autor o un admin los borra.

Por qué: con el acceso abierto, cualquiera —incluso sin sesión— podía editar o borrar cualquier animal por API; solo lo frenaba la pantalla de kadesh-landing. Es el primer paso de la fase 1 de Kadesh Pet en Operaciones (el admin edita desde el mismo formulario de kadesh-landing).

Qué no hacer: no volver a `generalAccess` en estas lists; no validar dueño en escrituras `sudo()` (reportes del servidor, semillas).

### 2026-10-14 — Registro de Facebook y administración desde Operaciones

Qué: `Animal` guarda `facebookPostId`, `facebookPublishedAt` y `facebookPublishedBy` cada vez que se publica, sea la publicación automática del admin o el botón de Operaciones (`adminPublishAnimalToFacebook`, que no repite salvo `force`). Operaciones lista y detalla animales con `adminAnimals` / `adminAnimalDetail` (estadísticas de vistas, favoritos y comentarios) y borra vistas con `adminPurgeAnimalViews`.

Por qué: los animales de usuarios no se publican solos y el admin necesita publicarlos a mano sin duplicar posts; sin registro no había forma de saber cuáles ya salieron. Revierte la decisión del 2026-09-29 de no guardar la fecha de publicación.

### 2026-10-23 — `Animal.pet` (cartilla)

Qué: relación opcional de un solo lado a `Pet`. La llena `markPetAsLost` cuando el reporte sale de la cartilla, y se queda como historial después de `markPetAsFound`. Solo la escriben un admin y el servidor (sudo). Leerla pasa por el acceso de `Pet`, así que para quien no es dueño es `null`.

Por qué: ligar el reporte con la mascota registrada sin exponer la cartilla en la ficha pública.

Qué no hacer: no exponer datos de la cartilla en la ficha pública; al borrar la mascota el reporte no se borra (la base pone `pet` en null).

### 2026-10-28 — Reportes repetidos, comentar en vez de duplicar y reclamar el reporte

Qué:
- La revisión de repetidos dejó de ser «mismo enlace o mismo teléfono + nombre». Ahora es un puntaje con cercanía, sexo, color, raza, señas y fecha, y también cruza perdidos con encontrados.
- Se agregaron `AnimalComment.kind`, la lista `AnimalClaim` (con `resolveAnimalClaim` / `cancelAnimalClaim`), `Animal.duplicateOf` y `Animal.duplicateCheck`.
- Hay siete tipos de notificación nuevos (`animal.commented`, `animal.duplicate_reported`, `animal.possible_match`, `animal.claim_requested`, `animal.claim_approved`, `animal.claim_rejected` y `animal.merged`).

Por qué: tres personas publicaron al mismo perro (Chaneque, Morelia) con teléfonos distintos y una ciudad distinta en cada slug, y la regla anterior no lo detectó. Quien reporta debe poder sumar información al reporte que ya existe en vez de duplicarlo. El dueño debe poder quedarse con un reporte que subió un voluntario. Quien atiende el reporte debe enterarse.

Qué no hacer:
- No comparar por ciudad: Nominatim regresa colonias distintas para puntos a 500 m.
- No exponer teléfonos en `findAnimalReportDuplicates`.
- No transferir un reporte sin aprobación de quien lo atiende (o de un admin).
- No borrar el repetido al unirlo: se queda como historial con `duplicateOf`.

