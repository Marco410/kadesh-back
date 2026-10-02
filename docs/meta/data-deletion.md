# Eliminación de datos (Meta)

Callback que Meta llama cuando una persona pide borrar lo que la app **Kadesh** tiene de ella. Hace falta para publicar la app en modo Live y pasar App Review.

Doc de Meta: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

## Qué hace

`POST /webhooks/meta/data-deletion` recibe `application/x-www-form-urlencoded` con un campo `signed_request` (`<firma>.<payload>`, ambos en base64url). Verifica la firma con HMAC-SHA256 y `META_APP_SECRET` (`crypto.timingSafeEqual`). Si la firma no cuadra o `algorithm` no es `HMAC-SHA256`, responde 400.

Del payload toma `user_id` (app-scoped user id), guarda un `MetaDataDeletionRequest` y llama a `deleteMetaUserData`. Hoy esa función no borra filas: no hay Facebook Login ni ningún campo que guarde ese id. La solicitud queda `completed`.

Respuesta:

```json
{ "url": "<FRONTEND_URL>/eliminacion-de-datos?code=<code>", "confirmation_code": "<code>" }
```

`GET /webhooks/meta/data-deletion/status?code=<code>` es público y devuelve `{ code, status, requestedAt, completedAt }`. 404 si el código no existe. No incluye el id de Meta ni notas.

Si falta `META_APP_SECRET` (o `FRONTEND_URL`, porque sin ella no hay URL que devolver), el POST responde 503 y hace `console.warn`. El proceso sigue arriba.

El body parser `express.urlencoded` está solo en el POST. El webhook de WhatsApp sigue leyendo el body crudo.

## URL para pegar en Meta

En la app de Meta: **App settings > Basic > Data deletion instructions URL**, elige **Data deletion callback URL** y pega:

```
<origen del backend>/webhooks/meta/data-deletion
```

El origen es `WHATSAPP_WEBHOOK_BASE_URL` sin slash final y sin `/webhooks/whatsapp` si esa variable lo trae. Ejemplo: `https://kadesh-back-production.up.railway.app/webhooks/meta/data-deletion`.

La página `<FRONTEND_URL>/eliminacion-de-datos` la sirve el front. Puede consultar el GET de arriba para mostrar el estado.

## Probar en local

1. En `config/.env.dev`: `META_APP_SECRET` (el App Secret de Configuración > Básica) y `FRONTEND_URL` (el origen del front, sin slash final).
2. Corre `yarn migrate` si la list `MetaDataDeletionRequest` todavía no está en la base.
3. Levanta el backend (`pnpm dev`).
4. Genera un `signed_request` (no habla con Meta):

```
pnpm meta:sign-request
pnpm meta:sign-request 218471
```

El script (`scripts/signMetaRequest.ts`) imprime el valor y un `curl` listo. La respuesta trae `confirmation_code`. El estado:

```
curl -s "http://localhost:3001/webhooks/meta/data-deletion/status?code=<confirmation_code>"
```

Un `signed_request` firmado con otro secreto debe responder 400.

## Decisiones

### 2026-10-02 — Callback sin datos de usuario de Meta

Qué: se acepta el callback, se guarda la solicitud y se marca `completed` porque `deleteMetaUserData` no encuentra nada que borrar.

Por qué: App Review lo exige ya, y Facebook Login / Embedded Signup todavía no guardan un app-scoped user id.

Qué no hacer: no borrar empresas, mensajes de WhatsApp ni tokens de Página a partir de este `user_id`. Esos datos no están ligados a él.
