# BlogSubscription

Suscripción al blog por producto (`pet` | `saas`). El correo de “nuevo post” solo sale a filas con `active: true` del producto del post (o de ambos si el post es `all`).

## Invariantes

- Unicidad lógica `(email, product)` (validada en hook; no hay índice compuesto en DB).
- `email` se guarda en **minúsculas**. Match de baja / unicidad es case-insensitive.
- Pausar (`active: false`) también apaga duplicados históricos del mismo email+product con distinto casing.
- `unsubscribeBlog(email, product)` solo baja ese producto: Pet y SaaS son independientes.
- Al crear un `User`, `userBlogSubscriptionHook` crea o vincula la suscripción de su `product`.

## Decisiones

### 2026-09-28 — Email normalizado + cascade al pausar

Qué: `resolveInput` lowercased el email; unicidad y `unsubscribeBlog` usan `mode: insensitive`; al pasar a `active: false` se desactivan siblings case-insensitive vía Prisma (sin re-disparar hooks).

Por qué: con casing distinto podían existir dos filas; la UI/admin mostraba la pausada y el envío seguía yendo a la activa.

Qué no hacer: no mezclar esto con correos de `SystemRelease` (novedades de plataforma): esos van a usuarios con cuenta y no miran `BlogSubscription`.
