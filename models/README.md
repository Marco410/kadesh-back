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

Qué no hacer: no bajar `NOTIFY_GRACE_MS` sin pensar en el caso "el cron estuvo caído unos días"; no quitarle el chequeo de `CRON_SECRET` a `publishScheduledPosts` (no tiene otra autorización); si el repo de `kadesh-back` se vuelve privado, revisar la cuota de minutos gratis de GitHub Actions antes de mantener el cron cada 10 min.
