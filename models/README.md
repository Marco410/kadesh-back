# Models

Lists de Keystone. El registro público sigue en `schema.ts`.

## Carpetas

- **`Pet/`** — app KadeshPet (adopción, directorio, tienda, anuncios, reseñas).
- **`Saas/`** — CRM, billing, workspaces e INEGI/IA (`Saas/Tech`).
- **Raíz** — compartidos entre las dos apps: `User`, `Role`, `ContactForm`, `TokenNotification`, `SystemRelease`, `Blog`.

Una list nueva va en `Pet/` o `Saas/` si es de un producto; en la raíz solo si la usan ambos.

## Decisiones

### 2026-09-17 — Pet / Saas / compartidos

Qué: se agruparon las lists en dos dominios. Tech quedó dentro de `Saas/Tech` (leads, tareas, INEGI, insights). User y Role se quedan afuera porque auth y permisos los usan los dos productos.

Qué no hacer: no volver a poner Animal, PetPlace o Store en la raíz; no subir Tech otra vez a `models/Tech`.

### 2026-09-21 — Blog compartido con discriminador `product`

Qué: `Blog/` (Post, Category, Tag, PostLike/Favorite/Comment/View, BlogSubscription) salió de `Pet/` porque ahora lo usan Pet y el SaaS. `Post`, `Category` y `BlogSubscription` tienen `product` (`pet | saas | all`; la suscripción solo `pet | saas`), con default `pet` para que lo existente siga siendo de Pet. Mismo patrón que `SystemRelease.product` (constantes en `utils/constants/product.ts`).

Reglas: cada front filtra por `product in [suyo, all]` en **todas** sus lecturas (si no, un post de un producto aparece en el otro). La categoría de un post debe ser del mismo producto. `BlogSubscription.email` ya no es único: la unicidad es `(email, product)` y se valida en `BlogSubscription.hooks.ts`. El correo de nuevo post sale solo a suscriptores de ese producto, con su URL (`PET_FRONTEND_URL` / `SAAS_FRONTEND_URL`) y marca.

Qué no hacer: no volver a meter el blog en `Pet/`; no reusar un valor de `POST_CATEGORIES` en los dos productos (`Category.name` es único).

### 2026-09-22 — Programar posts a futuro

Qué: `Post.publishedAt` ahora es editable desde la creación y programa la publicación: si al marcar `published` el editor no puso fecha, se usa "ahora" (`Post.hooks.ts` → `publishedAtHook`); si puso una fecha futura, se respeta y ya no se pisa en guardados posteriores. Los dos fronts filtran `publishedAt: { lte: now }` además de `published: true` en toda lectura pública (`components/blog/server.ts` de cada repo), así que el post queda invisible hasta esa fecha sin que nada del backend tenga que "despertar" — es lectura perezosa, coherente con `docs/ai/fase-2-digest-diario.md` ("sin cron").

El correo de nuevo post sí sale automáticamente en la fecha programada: `notifyNewPostIfDue` (extraída de `newPostEmailHook` en `Post.hooks.ts`) la llaman tanto el hook de create/update como la mutación `publishScheduledPosts` (`graphql/customs/mutations/publishScheduledPosts.ts`, autorizada con `CRON_SECRET`, no con sesión). Un cron de GitHub Actions (`.github/workflows/publish-scheduled-posts.yml`, cada hora en punto, gratis porque el repo es público) la llama para posts en los que nadie vuelve a entrar al admin. `publishedNotifiedAt` evita reenvíos en cualquiera de los dos caminos.

`NOTIFY_GRACE_MS` (3 días) evita que un post viejo —cualquiera publicado antes de que existiera `publishedNotifiedAt`, que nace en `null`— dispare un correo masivo si alguien lo edita o si el cron lo barre: solo se notifica si `publishedAt` venció hace menos de esa ventana. No hizo falta backfill de datos por esto.

Qué no hacer: no bajar `NOTIFY_GRACE_MS` sin pensar en el caso "el cron estuvo caído unos días"; no quitarle el chequeo de `CRON_SECRET` a `publishScheduledPosts` (no tiene otra autorización); si el repo de `kadesh-back` se vuelve privado, revisar la cuota de minutos gratis de GitHub Actions antes de mantener el cron cada hora.

### 2026-09-22 — Publicar posts en Facebook

Qué: al publicarse un post (mismo trigger que el correo), también se publica en la Página de Facebook del producto (`pet`/`saas`; `all` publica en las dos). `publishedToFacebookAt` (nuevo campo, editable en el Admin UI) es el flag de "ya se intentó", con la misma ventana de gracia (`NOTIFY_GRACE_MS`) y el mismo trade-off que el correo: se marca _antes_ de intentar, así que un fallo (ej. token vencido) no reintenta solo — hay que vaciar el campo a mano para forzar un reintento. `postPublishSideEffectsHook` (antes `newPostEmailHook`) en `Post.hooks.ts` llama a `notifyNewPostIfDue` y a `publishPostToFacebookIfDue`; la mutación `publishScheduledPosts` llama a las dos por cada post pendiente de cualquiera de los dos flags.

`utils/intregrations/facebook.ts` es el wrapper crudo de la Graph API (mismo patrón que `utils/intregrations/smtpMail.ts`): no lanza si `FACEBOOK_{PET,SAAS}_PAGE_ID`/`_ACCESS_TOKEN` no están configurados (solo warnea), sí lanza si la llamada falla. El link publicado es la URL del post (`frontendUrlFor(product)` + `/blog/<url>`, ya existía para el correo) — Facebook scrapea el Open Graph solo, no hace falta mandarle imagen/título aparte.

**Detalle de correctitud:** con dos flags independientes (`publishedNotifiedAt`, `publishedToFacebookAt`) escribir la marca con `context.sudo().db.Post.updateOne(...)` es un bug — esa llamada vuelve a disparar `afterOperation` (Keystone corre el pipeline completo de hooks tanto para `db` como para `query`, solo `context.prisma` lo salta), y esa reentrada puede procesar el _otro_ flag con datos frescos justo antes de que el código externo lo vuelva a procesar con su copia vieja de `item` → duplicado. Por eso ambas funciones marcan con `context.sudo().prisma.post.update(...)` (mismo patrón ya usado en `utils/access/attachUserToCompany.ts` y `utils/ai/rateLimit.ts`), que no pasa por hooks.

Qué no hacer: no volver a marcar estos flags con `context.db`/`context.query` — solo `context.prisma`; no compartir un solo flag entre correo y Facebook (fallos de causas distintas: un token de Meta vencido no debe bloquear el correo).

### 2026-09-22 — WhatsApp Business por SaasCompany (BYOK completo, chat de ida y vuelta)

Qué: cada `SaasCompany` conecta su propio WhatsApp Business (Cloud API de Meta) con BYOK **completo** — cada empresa trae su propia App de Meta (no una sola App de Kadesh), porque la firma del webhook (`X-Hub-Signature-256`) se calcula con el App Secret de la App dueña del número. Por eso `SaasCompany` guarda cifrados el access token Y el app secret de cada empresa (`whatsappAccessTokenEncrypted`/`whatsappAppSecretEncrypted`, mismo patrón que `aiApiKeyEncrypted` — campo con `access: {read/create/update: () => false}`, solo tocable vía sudo). `whatsappPhoneNumberId` es único e indexado: es la clave para enrutar el webhook entrante a la empresa correcta.

Un solo endpoint de webhook (`/webhooks/whatsapp`, registrado en `keystone.ts` vía `server.extendExpressApp` — primer uso de este hook en el repo, no había ningún endpoint no-GraphQL antes) recibe los mensajes de **todas** las empresas conectadas: identifica la empresa por `phone_number_id` del payload, descifra SU app secret, y valida la firma con eso. El body debe leerse crudo (`express.raw`) antes de verificar la firma — `extendExpressApp` corre antes de que Keystone monte su propio `bodyParser.json` (que solo aplica al path de GraphQL), así que no hay conflicto.

Historial en `TechWhatsAppMessage` (nueva list, `models/Saas/Tech/WhatsAppMessage/`), acotado por lead con el mismo criterio que `TechStatusBusinessLead` (`whatsappMessageScopedWhere` en `utils/access/leadScopedFilter.ts`, envuelve `leadCompanyScopedWhere` bajo `businessLead:`). El matching de un mensaje entrante a un `TechBusinessLead` es una heurística (`phone: {contains: últimos10Dígitos}`) — no hay normalización real de teléfonos en este repo.

Envío solo de texto libre, solo dentro de la ventana de 24h desde el último mensaje del lead (limitación de la Cloud API sin plantillas aprobadas — fuera de alcance por ahora).

Qué no hacer: no asumir una sola App de Meta compartida entre empresas (eso requeriría que Kadesh sea Tech Provider ante Meta, revisión de negocio incluida — decisión explícita de NO hacerlo); no mandar mensajes fuera de la ventana de 24h sin plantilla aprobada (Meta lo rechaza, error 131047); no montar esto en `kadesh-landing` — es una feature de Kadesh Negocios (B2B), no de Kadesh Pet; no hardcodear `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (ni la Callback URL) en el código del front — aunque no sea un secreto de alto riesgo, se sirve autenticado vía `companyWhatsappWebhookInfo` (`graphql/customs/queries/whatsapp/`), gateado por `canManageCompanyWhatsapp`, para que el front nunca lo traiga embebido en su bundle público.

### 2026-09-22 — Iniciar conversación sin fricción (plantilla automática) + media

Qué: se descartó explícitamente una librería no oficial de WhatsApp (Baileys/whatsapp-web.js) para evitar la plantilla obligatoria de Meta — el riesgo de que le baneen el número a un cliente sin aviso no es aceptable en un producto que se vende a terceros. Se resolvió con la API oficial, automatizando lo único que Meta exige: en `testCompanyWhatsappConnection.ts`, al conectar WhatsApp se crea sola (best-effort) una plantilla `MARKETING` fija (`utils/whatsapp/ensureOutreachTemplate.ts`) — nadie entra a Meta a crear nada a mano. El estatus de aprobación se sigue por el mismo webhook que ya recibía mensajes (`webhooks/whatsapp.ts`, evento `message_template_status_update`), enrutado por `whatsappBusinessAccountId` (ahora único e indexado, igual que `whatsappPhoneNumberId`) en vez de por número de teléfono — ese evento no trae `phone_number_id`.

Cuando el lead no ha escrito en 24h, el CRM ya no deja mandar texto libre (Meta lo rechaza): la query `businessLeadWhatsappStatus` le dice al front si puede responder libre o si debe usar la mutación `startWhatsAppConversation` (manda la plantilla con el nombre del lead y el de la empresa). Importante para quien pague esto: las plantillas `MARKETING` sí las cobra Meta por mensaje — la empresa necesita el método de pago que pide WhatsApp Manager para poder usarlas, aunque conteste gratis a mensajes entrantes.

Media (imágenes/documentos, ambas direcciones): **no se usan los campos `image`/`file` nativos de Keystone** — esos están pensados para una subida que pasa por el `createOne` de la propia list, y aquí el binario sale de la Media API de Meta (al mandar) o de un `id` de Meta en el webhook (al recibir), no de un usuario subiendo un archivo a un campo. Se armó `utils/intregrations/s3Storage.ts`, un cliente R2 propio con `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (ambas ya eran dependencias transitivas de Keystone, no hubo que agregar nada a `package.json` — mismo riesgo ya aceptado antes con `express` en `webhooks/whatsapp.ts`). `TechWhatsAppMessage.mediaKey` guarda la key en R2, nunca una URL fija (se vencería); `TechWhatsAppMessage.mediaUrl` es un campo calculado (`extend type` en `graphql/extendedSchema.ts`, mismo mecanismo que `PetPlace.slug`) que firma la URL al vuelo, 1h de vigencia, igual criterio que el resto del bucket.

Qué no hacer: no guardar una URL de R2 fija en la base — siempre `mediaKey` + firmar al leer; no reemplazar `ensureOutreachTemplate` por un flujo donde el usuario redacta su propia plantilla (se decidió explícitamente "cero fricción": una plantilla fija en código); no asumir que el front puede subir media directo a Meta — siempre pasa por el backend (`sendWhatsAppMediaMessage`), que sube a Meta Y guarda copia permanente en R2 en el mismo paso.

### 2026-09-23 — Chats internos con el equipo y visibilidad por asignación

Qué: la bandeja de WhatsApp ahora tiene dos tipos de conversación y reglas de quién ve qué.

`TechWhatsAppMessage` gana `teamMember` (conversación interna con alguien de la propia empresa, en vez de con un lead) e `internalInitiator` (quién abrió ese hilo). Un mensaje tiene `businessLead` **o** `teamMember`; si no tiene ninguno, es un número que no matcheó con nadie. El webhook, cuando el teléfono entrante no es de ningún lead, lo busca entre los usuarios de la empresa (misma heurística de últimos 10 dígitos) y hereda el `internalInitiator` del último mensaje de ese hilo, para que la respuesta caiga en la conversación correcta.

`whatsappMessageScopedWhere` deja de ser "el mismo filtro que el lead" y pasa a resolver los tres casos: chat con lead → criterio del lead (un vendedor solo ve los suyos); chat interno → solo el `teamMember` y el `internalInitiator`; sin matchear → solo admins (por eso ahora el filtro cuelga de `company` y no de `businessLead`: un filtro anidado sobre la relación nunca matchea las filas que la tienen vacía, así que antes ni los admins veían esos mensajes).

**Asignar un chat a un vendedor = asignarle el lead** (`TechBusinessLead.salesPerson`, vía `assignWhatsAppConversation`, solo admin de empresa). Se decidió explícitamente NO agregar un campo de asignación propio de WhatsApp: la visibilidad de los mensajes ya cuelga de esa asignación, y un segundo campo sería una segunda fuente de verdad con sus propias reglas de acceso que mantener en sync.

`whatsappConversations` dejó de usar `sudo()`: al consultar con el contexto del usuario, el filtro del list es el que acota la bandeja, sin duplicar las reglas en el resolver. `resolveWhatsAppTarget` (`mutations/whatsapp/target.ts`) centraliza "¿a quién le escribo y puedo?" para las cuatro operaciones (texto, media, plantilla, status): para un lead consulta **sin sudo**, así un vendedor tampoco puede escribirle a un lead que no tiene asignado.

Limitación conocida: si dos personas distintas le escriben al mismo compañero, el hilo interno queda con el `internalInitiator` de quien escribió primero, y cada quien ve solo los mensajes que le tocan — no hay una entidad "conversación" con lista de participantes. Si eso empieza a estorbar, ese es el refactor.

Qué no hacer: no volver a poner `sudo()` en `whatsappConversations` (ahí vive la regla de visibilidad); no agregar un campo "assignedTo" propio de WhatsApp sin quitar el que ya hay; no asumir que un mensaje siempre tiene lead.

### 2026-09-23 — Plantilla de inicio: ejemplos obligatorios y error visible

Qué: `createWhatsAppTemplate` ahora manda `example.body_text` con un valor por variable. Meta rechaza crear una plantilla con `{{1}}`/`{{2}}` si no lleva ejemplos, y como `ensureOutreachTemplate` es best-effort el fallo quedaba solo en un `console.error`: el usuario veía "No se pudo crear la plantilla" sin saber por qué. Ahora `ensureOutreachTemplate` **devuelve** el motivo (mensaje de Meta) y `testCompanyWhatsappConnection` lo expone en `templateError`; el front lo muestra. No se persiste (evita otro campo y otra migración): llega en la respuesta de cada prueba.

Además, crear plantillas exige que el access token tenga `whatsapp_business_management`, no solo `whatsapp_business_messaging`. Con solo el segundo la conexión prueba OK y los chats funcionan, pero la plantilla nunca se crea — es el fallo más fácil de confundir con un bug nuestro.

`parseGraphError` (`utils/intregrations/whatsapp.ts`) pliega `error_user_title`, `error_user_msg` y `error_subcode` al mensaje: Meta responde "Invalid parameter" a casi todo y el motivo real viaja en esos campos. No lo reduzcas otra vez a `error.message` — sin ellos un error de Meta no dice qué corregir.

Antes de crear la plantilla, `ensureOutreachTemplate` consulta a Meta qué cuenta es el `whatsappBusinessAccountId` guardado y si incluye el `whatsappPhoneNumberId` conectado (`fetchWhatsAppBusinessAccountInfo`). Copiar un ID equivocado es el error más común de BYOK y Meta lo contesta con un genérico "Invalid parameter" que no dice cuál ID estaba mal; con esta comprobación el mensaje lo dice, y los demás errores de la plantilla llevan el **nombre de la cuenta** (permite distinguir, p. ej., la cuenta de prueba de Meta de una real).

Qué no hacer: no volver a tragarse el error de la plantilla; no quitar los ejemplos (`OUTREACH_TEMPLATE_EXAMPLES`, uno por variable y en orden); no pedir en la guía del front solo el permiso de mensajería.
