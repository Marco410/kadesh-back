# Models

Lists de Keystone. El registro público sigue en `schema.ts`.

## Carpetas

- **`Pet/`** — app KadeshPet (adopción, directorio, tienda, blog).
- **`Saas/`** — CRM, billing, workspaces e INEGI/IA (`Saas/Tech`).
- **Raíz** — compartidos entre las dos apps: `User`, `Role`, `ContactForm`, `TokenNotification`, `SystemRelease`.

Una list nueva va en `Pet/` o `Saas/` si es de un producto; en la raíz solo si la usan ambos.

## Decisiones

### 2026-09-17 — Pet / Saas / compartidos

Qué: se agruparon las lists en dos dominios. Tech quedó dentro de `Saas/Tech` (leads, tareas, INEGI, insights). User y Role se quedan afuera porque auth y permisos los usan los dos productos.

Qué no hacer: no volver a poner Animal, PetPlace o Store en la raíz; no subir Tech otra vez a `models/Tech`.
