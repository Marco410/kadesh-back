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
- **Correo al dueño** (`Animal.publishedEmail.ts`): con el primer `AnimalLog` creado con sesión, el dueño (`Animal.user`) recibe «Tu reporte ya está publicado» cuando ya están las fotos (2.5 s tras la última, 90 s si no hay). Lleva sus datos, la tarjeta `/animales/{slug}/og` y lo que puede hacer: compartir, agregar registros, editar, alertas de zona, avisos por WhatsApp e impulsar en Facebook (solo `lost`/`found`). No sale sin sesión, al usuario de automatización (`PET_AUTOMATION_USER_ID`), a cuentas anonimizadas o suspendidas, ni si el reporte ya está unido a otro o se borró. La espera vive en el proceso, igual que la de Facebook.
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
- **Seguimiento de casos** (`Animal.followUp.ts`, cron `sendAnimalFollowUps`): cada registro nuevo pone `lastActivityAt`, reinicia `followUpStage` y quita `inactiveAt`. En un caso abierto (último registro `lost`, `found`, `rescued`, `abandoned` o `in_adoption`, sin desenlace ni repetido):
  - A los 7 días sin registros sale el primer recordatorio y a los 21 el segundo (al menos 7 días después del primero). Van a quien atiende el reporte por campana, push, WhatsApp (`kadesh_pet_seguimiento`, solo con opt-in) y correo, con enlaces a `?accion=cerrar` y `?accion=registro`. Nunca a la automatización.
  - Sin respuesta, a los 45 días (y al menos 14 tras el segundo) el caso queda `inactiveAt` y `getNearbyAnimals` ya no lo lista. Los reportes sin dueño o de la automatización, a los 30 días. Un registro nuevo lo reactiva.
  - Topes por corrida: 200 recordatorios y 500 casos inactivos.
- **Desenlace del caso** (`Animal.outcome.ts`): `outcome` (`reunited`, `adopted`, `other_home`, `deceased`, `closed_unresolved`) y `closedAt` son públicos; `helpedByKadesh`, `outcomeChannel`, `outcomeStory` y `storyConsent` solo los leen quien atiende el reporte y un admin. Ninguno se escribe con `updateAnimal`: solo `closeAnimalReport`, el hook de la bitácora o un admin.
  - `closeAnimalReport` guarda las respuestas y deja la bitácora final con la ubicación de la última (`in_family`, `adopted` o `closed`, que es «Caso cerrado» sin hogar). Si el caso ya estaba cerrado, solo corrige las respuestas.
  - Cualquier otra bitácora final (web o app vieja, cartilla, adopciones, rescate) llena `outcome` y `closedAt` sin respuestas, siempre que antes hubo un caso abierto (`lost`, `found`, `rescued`, `abandoned`, `in_adoption`). Una bitácora de caso abierto sobre un caso cerrado lo reabre y limpia el cierre.
- **La misma persona publicando otra vez** (`Animal.ownDuplicates.ts`, solo `createAnimal` con sesión y sin admin): busca sus reportes del mismo tipo de los últimos 90 días que no estén unidos a otro ni cerrados. Cuenta como el mismo animal si el nombre es igual o parecido (`compareNames`). Con nombre genérico («Sin nombre») solo cuenta si es de las últimas 24 h, con el mismo teléfono y la misma descripción.
  - Si ya tiene uno con bitácora, el alta falla con «Ya publicaste a {nombre}…» y el link a su reporte.
  - Si quedó uno a medias (sin bitácora ni fotos, comentarios, solicitudes, favoritos, mascota o repetidos encima), se borra al crear el nuevo. Queda `pet.incomplete_report_removed` en `ActivityEvent`.
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

### 2026-11-03 — Filtro por estatus actual en Operaciones

Qué: `adminAnimals` recibe `status` (un valor de `ANIMAL_LOGS_OPTIONS`) y devuelve solo los animales cuyo registro más reciente en la bitácora tiene ese estatus. «Más reciente» = `date_status` y luego `createdAt`, descendente: el mismo orden que la ficha pública, `markPetAsFound` y `petLandingStats`. El estatus de la fila (`AdminAnimalRow.status`) pasó de ordenar solo por `createdAt` a ese mismo orden. `register` también cuenta bitácoras que guardaron la etiqueta «Registrado» (era el `defaultValue` del campo).

Por qué: la lista se pagina en el servidor, así que el filtro no puede hacerse en el front. El badge y el filtro deben usar el mismo orden o un animal filtrado como «Perdido» podría mostrar «Encontrado».

Qué no hacer: no filtrar con `logs: { some: { status } }`, que trae animales que alguna vez tuvieron ese estatus aunque ya no lo tengan.

### 2026-11-03 — Resumen de Kadesh Pet en Operaciones

Qué: `adminPetSummary` y `adminPetSeries` (`graphql/customs/queries/admin/adminPet.ts`) cuentan animales por estatus actual, tipo, origen y ubicación, y registros por día, semana o mes. Usan el mismo «último registro de la bitácora» que `adminAnimals` y no cuentan duplicados fusionados.

Por qué: Operaciones necesitaba ver cuántos animales hay perdidos, encontrados o en adopción y cómo crecen los registros. Detalle y reglas en `graphql/customs/queries/admin/README.md`.

### 2026-11-03 — La misma persona no publica dos veces el mismo animal

Qué: `createAnimal` revisa en el servidor si la persona ya tiene ese reporte (ver Invariantes). Si está completo, no la deja publicar otro. Si quedó a medias, lo borra al crear el nuevo. La web y la app retoman el paso que falló (bitácora o fotos) en vez de crear otro animal.

Por qué: la web y la app publican en tres pasos (`createAnimal` → `createAnimalLog` → `createAnimalMultimedias`). Si fallaba la bitácora o las fotos y la persona reintentaba, quedaba otro animal: «Nano» salió tres veces, dos sin foto ni ubicación. El aviso de parecidos del front se puede cerrar y no ve los reportes sin bitácora, y `createAnimalReport` era el único que revisaba en el servidor.

Qué no hacer: no frenar aquí reportes de otras personas (dueño y voluntario pueden reportar al mismo animal; para eso están el aviso de parecidos, los comentarios y `duplicateOf`). No borrar un reporte con bitácora, fotos o algo encima.

### 2026-11-03 — Texto del post de Facebook con emojis y todos los datos

Qué: el post de la Página de Pet ya no es solo «nombre + señas». `buildAnimalFacebookMessage` (`Animal.facebookPost.ts`) arma un encabezado por estatus (🆘 ¡SE BUSCA!, 📢 ¡ENCONTRADO!, 🏡 ¡EN ADOPCIÓN!…), el emoji del tipo y la raza (🐶, 🐈‍⬛, 🐩…), sexo, edad, color, tamaño, dónde y cuándo (del registro más reciente), señas, notas, qué hacer y hashtags (estatus, ciudad, #KadeshPet). Concuerda con el sexo (encontrado/encontrada). Aplica a la publicación automática y al botón de Operaciones; los posts que ya salieron no cambian.

Por qué: el post salía muy seco y mucha gente no llena todo; la ubicación y el estatus ya estaban en la bitácora pero no salían.

Qué no hacer: no poner el teléfono en el post. El contacto está en la ficha (el enlace del post) y la Página tiene mucho alcance.


### 2026-11-05 — Animales a nombre de un espacio de rescate (`Animal.organization`)

Qué: un animal puede publicarse a nombre de un espacio de rescate (`RescueOrganization`, ver su README). `user` sigue siendo quien lo publicó.
- Además del autor, lo editan los admins, coordinadores y voluntarios de la organización, y lo borran sus admins y coordinadores. Esto aplica también a sus fotos y bitácora (`editableAnimalFilter`).
- Solo su equipo puede conectar la organización, y solo si está `pending` o `verified` (`validateAnimalOrganization`).
- `viewerCanEdit` le dice al front si quien consulta puede editar, sin exponer al equipo.
- Si se aprueba un reclamo, el reporte deja de estar a nombre de la organización.

Por qué: los rescatistas trabajan en equipo y publicaban como «voluntario» suelto, sin perfil ni respaldo.

Qué no hacer: no mostrar la organización mientras no esté verificada. El acceso de lectura de `RescueOrganization` ya la oculta: no saltárselo con sudo en consultas públicas.


### 2026-11-10 — Correo «Tu reporte ya está publicado» al dueño

Qué: `animalLogSlugAfterOperation`, en el primer registro y con sesión, arranca `watchAnimalForPublishedEmail`. Al vencer la espera, `sendAnimalPublishedEmailFor` relee el reporte y manda `sendAnimalPublishedEmail` (`utils/helpers/sendgrid.ts`): datos del animal, la tarjeta para compartir y «Qué puedes hacer ahora». Personaliza según el dueño: si ya tiene alertas de zona dice dónde, y si ya tiene avisos por WhatsApp no los vuelve a ofrecer.
- La espera de Facebook se volvió una fábrica (`animalSettleWatcher.ts`): cada espera es independiente y `noteAnimalSlugSettled` / `noteAnimalCoverSaved` avisan a todas. Por eso las fotos guardadas con prisma (`createAnimalReport`, `copyPetPhotosToReport`) también despiertan al correo.
- Enlaces directos que entiende la ficha de kadesh-landing (y la app, ver su prompt de mobile-sync): `/animales/{slug}?accion=registro` abre «Agregar registro» y `?accion=impulsar` abre «Impulsar en Facebook». Si se cambian aquí, cambiarlos allá (`ANIMAL_DETAIL_ACTION`).

Por qué: quien publicaba no recibía nada y no sabía que podía agregar registros, activar alertas o avisos por WhatsApp. El disparador es el primer registro y no el `create` del Animal porque el estado y el lugar viven en el registro, y un alta a medias puede borrarse (`removeIncompleteOwnReports`). Se espera a las fotos porque la tarjeta `/og` se cachea en el edge: pedirla antes la dejaría sin foto también para quien comparta el enlace.

Qué no hacer: no usar la URL de S3 de la foto en el correo (caduca en 1 h). No activar los avisos por WhatsApp por la persona: solo se le invita (Meta exige que cada quien acepte). En el bloque de impulsar, respetar las reglas de texto de `kadesh-landing/src/components/animals/promotion/README.md` (opcional, todo va a Meta, sin cifras ni urgencia, antiestafa).


### 2026-11-12 — Cerrar el caso con «¿volvió a casa?» y contador de reencuentros

Qué: campos de desenlace en `Animal` (ver Invariantes), la mutación `closeAnimalReport`, el estatus de bitácora `closed` («Caso cerrado») y tres cifras nuevas en `petLandingStats`: `reunions`, `adoptions` y `helpedByKadesh` (casos con hogar en los que quien cerró dijo que Kadesh ayudó). Backfill: `pnpm animals:backfill-outcomes` (reporte) y `--apply`.

Por qué: la portada va a mostrar cuántos animales volvieron a casa y cuántos fueron adoptados, y solo contábamos el último estatus de la bitácora, sin saber si Kadesh ayudó ni cuándo se cerró. Además, los casos que no terminan en hogar (falleció, se dejó de buscar) no tenían cómo cerrarse y se quedaban en el mapa.

Qué no hacer: no contar un reencuentro por el estatus de la bitácora (un animal que nace «En familia» no lo es): usar `outcome`. No inventar `helpedByKadesh` en los cierres sin respuesta: vacío es «no respondió». No publicar `outcomeStory` sin `storyConsent`.


### 2026-11-12 — Recordatorios de seguimiento y casos inactivos

Qué: campos `lastActivityAt`, `followUpStage`, `followUpSentAt` e `inactiveAt` (ver Invariantes), el hook `touchAnimalActivity` en la bitácora, la mutación `sendAnimalFollowUps` con su workflow diario (`.github/workflows/send-animal-follow-ups.yml`, 16:00 UTC), el tipo de aviso `animal.follow_up` con la plantilla `kadesh_pet_seguimiento` y el correo `sendAnimalFollowUpEmail`. `getNearbyAnimals` excluye los casos inactivos. Backfill: `pnpm animals:backfill-activity`, que hay que correr justo después de la migración porque la columna nueva arranca con la fecha de ese momento.

Por qué: sin recordar a la gente que cierre o actualice el caso, el contador de reencuentros no crece y el mapa se llena de casos viejos que ya nadie busca.

Qué no hacer: no borrar casos inactivos ni cerrarlos solos: solo dejan de salir en el mapa y la ficha sigue abierta. No mandar el recordatorio a la cuenta de automatización. No correr el cron antes del backfill: todos los casos se verían recién actualizados y luego, al corregirlos, saldría una ola de recordatorios de golpe (con el backfill también sale, pero topada a 200 por día).
