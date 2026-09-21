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
