# Blog Post

Posts del blog compartido (Pet / SaaS / ambas). Al publicarse disparan correo a suscriptores y publicación en Facebook y LinkedIn.

## Invariantes

- Tres flags independientes: `publishedNotifiedAt` (correo), `publishedToFacebookAt`, `publishedToLinkedInAt`. Un fallo de una red no debe bloquear las otras.
- Ventana de gracia `NOTIFY_GRACE_MS` (3 días): solo side effects si `publishedAt` venció hace menos de eso. Evita spam al nacer un flag nuevo en `null`.
- Marcar flags **antes** de intentar, y solo con `context.sudo().prisma.post.update` (nunca `db`/`query`: re-disparan `afterOperation` y pueden duplicar).
- `product` `all` → Pet y SaaS; `pet` / `saas` → solo esa página.
- Reintento: vaciar el flag correspondiente en el Admin UI (tras renovar token, etc.), siempre dentro de la gracia.

## Decisiones

### 2026-09-29 — LinkedIn Company Pages

Qué: espejo de Facebook con REST Posts API y `publishedToLinkedInAt`. Detalle en `models/README.md` y `utils/intregrations/linkedin.ts`.

Qué no hacer: no mezclar con el path de animales (`Animal.hooks`); no crear migraciones desde el agente.
