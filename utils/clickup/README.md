# Posts del blog desde ClickUp

Cuando una tarea de la lista Publicaciones pasa a **aprobado**, ClickUp llama
`POST /webhooks/clickup`. El backend crea un `Post` programado (`published: true`,
`publishedAt` a futuro) y regresa la tarea a **programado** con la URL. El correo
y Facebook siguen saliendo por `publishScheduledPosts`; este módulo no los toca.

## Invariantes

- Firma: `X-Signature` = HMAC-SHA256 hex del body crudo, con `CLICKUP_WEBHOOK_SECRET`.
  Si falta o no coincide → 401. Se responde 200 antes de crear el post.
- Solo `taskStatusUpdated` cuyo `history_items[].after.status` sea `aprobado`.
- El producto sale de `task.list.id`: `CLICKUP_PET_LIST_ID` → `pet`,
  `CLICKUP_SAAS_LIST_ID` → `saas`. Otra lista del workspace no se comenta ni cambia de estado.
- `publishedAt` = `task.due_date` (ms UTC). Vacío o ya vencido → ahora + 10 minutos.
- `category` queda vacía. No hay custom fields.
- `clickupTaskId` es único y nullable. Los posts viejos quedan en `null` (Postgres permite
  varios null en un único). Un default `""` haría fallar la migración: todos los posts
  existentes compartirían el mismo string vacío.
- Portada, en este orden: (1) el primer adjunto `image/*`, con las mismas reglas de
  siempre — jpg/png/webp, máx. 8 MB; si ese adjunto no sirve, es error y no se busca otra
  foto; (2) si no hay adjunto, Pixabay, con las palabras del comentario más reciente que
  tenga una línea `imagen:` (máx. 100 caracteres). Sin ese comentario no se inventa una
  búsqueda con el título. (3) si Pixabay no da imagen, estado `error` y comentario
  `No hay imagen: adjunta una o agrega un comentario 'imagen: palabras en inglés' y vuelve a aprobar.`
- La foto de Pixabay se descarga y se guarda en R2. La URL de Pixabay no se guarda en el post.
  El comentario de éxito suma una segunda línea: `Foto: <user> en Pixabay — <pageURL>`.
- La imagen se sube con `context.images("s3_posts")` y se guarda en
  `image_id`, `image_extension`, `image_filesize`, `image_width`, `image_height`.
  La key es la del Admin (`posts/{id}.{ext}` o `dev/posts/…`).
- Un fallo después de saber que la lista es nuestra deja la tarea en `error` con el motivo.
  Si el post ya se había creado, se borra (también la imagen) para que el siguiente
  `aprobado` pueda reintentar: si se quedara, el `clickupTaskId` solo comentaría la URL
  y no volvería a pasar la tarea a `programado`.
- Si ni siquiera se pudo leer la tarea, no se toca el estado (podría ser otra lista).

## Variables

| Variable | Uso |
| --- | --- |
| `CLICKUP_API_TOKEN` | Token personal. Header `Authorization` sin `Bearer`. |
| `CLICKUP_WEBHOOK_SECRET` | Secret que imprime `pnpm clickup:register-webhook`. |
| `CLICKUP_PET_LIST_ID` | Lista Publicaciones de Kadesh Pet (`901717498002`). |
| `CLICKUP_SAAS_LIST_ID` | Lista Publicaciones de Kadesh Negocios (`901717498004`). |
| `PIXABAY_API_KEY` | API key de Pixabay. Va en la query de la API, nunca en un log. Sin ella, una tarea sin adjunto cae al error de "no hay imagen". |
| `WHATSAPP_WEBHOOK_BASE_URL` | Dominio público del backend; el endpoint es `{base}/webhooks/clickup`. |

El webhook es uno solo, a nivel workspace (`team` `9017505640`), sin `list_id`.

## Decisiones

### 2026-10-01 — Aprobar en ClickUp programa el post

Qué: el tablero Publicaciones tiene `por revisar` → `aprobado` → `programado`, más `error`.
Este módulo hace el salto de aprobado a programado. `Post.hooks.ts` solo exporta
`frontendUrlFor`; el cron horario no cambia.

Qué no hacer: no registrar un webhook por lista (son dos espacios y el secret sería distinto);
no leer custom fields; no publicar la imagen con `uploadBufferToStorage` (esa key no la firma
el campo `image`).

### 2026-10-01 — Sin imagen no se publica

Qué: jpg/png/webp y máximo 8 MB. Un gif u otro formato, aunque el mimetype empiece con
`image/`, también es error: se usa el primero, no se busca otro ni se cae a Pixabay.

Por qué: el post sale al sitio y a Facebook. Un adjunto malo no debe reemplazarse en
silencio por una foto de stock.

### 2026-10-01 — Sin adjunto, la foto sale de Pixabay

Qué: si la tarea no trae adjunto, se busca en Pixabay (`image_type=photo`,
`orientation=horizontal`, `min_width=1200`, `lang=en`). Las palabras salen del comentario
más reciente con una línea `imagen:`. Un comentario nuevo gana sobre el anterior. No se
usa el título de la tarea. Se descarga `largeImageURL` (si falla, `webformatURL` de al
menos 640 px) y se guarda en R2: Pixabay no permite dejar el enlace caliente. El crédito
va solo en el comentario de ClickUp (`pageURL`).

Qué no hacer: no meter la atribución ni la URL de Pixabay en `Post`; no loguear la URL de
la API (lleva la key); no usar Pixabay cuando el adjunto existe y falla.
