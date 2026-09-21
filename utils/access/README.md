# Access / tenant

Helpers de tenant usados por registro, Google y seed. No son GraphQL.

## Invariantes

- Ligar un User a `SaasCompany` va por `attachUserToCompany` (Prisma sudo). El field access de GraphQL niega el connect.
- Alta de empresa de signup: `provisionSignupCompany` — crea la company (el hook pone workspace **Ventas** + plan free) y mete al usuario como miembro.

## Decisiones

### 2026-09-21 — provisionSignupCompany

Qué: un solo helper para registro y seed del admin.

Por qué: el seed de Marco tenía User sin company; el CRM exige tenant.

Qué no hacer: no duplicar create + attach + workspace en `registerUser` y en `utils/seed/user.ts`.
