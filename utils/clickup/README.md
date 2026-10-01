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
- Sin imagen jpg/png/webp de hasta 8 MB no se crea el post: estado `error` y comentario
  `Falta adjuntar la imagen` (o el motivo, si el archivo no sirve).
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

Qué: si no hay un adjunto `image/*`, la tarea va a `error` con `Falta adjuntar la imagen`.
jpg/png/webp y máximo 8 MB. Un gif u otro formato, aunque el mimetype empiece con `image/`,
también es error: se usa el primero, no se busca otro.

Por qué: el post sale al sitio y a Facebook. Publicarlo sin portada y luego no poder
adjuntarla (el `clickupTaskId` ya existe) deja una ficha rota. Adjuntar la imagen y
volver a pasar la tarea a `aprobado` reintenta.
