# Seed

Datos iniciales al correr `yarn db:seed` (`seed.ts` → `index.ts`). Cada helper es idempotente: no duplica filas que ya existen.

## Invariantes

- El admin se busca **por email** (`marco_pascual410@hotmail.com`). Si no está, se crea. Otros usuarios en la DB no saltan este seed.
- Si ese user no tiene company, se crea **Kadesh** con `provisionSignupCompany` (igual que `registerUser`: workspace Ventas + plan free). Los planes se seedean **antes** del user para que el hook encuentre `cost = 0`.
- Roles, tipos y planes se upsertan o se saltan si ya hay filas (ver cada archivo).

## Decisiones

### 2026-09-21 — Admin seed por email

Qué: `createUserAdmin` deja de abortar si existe _cualquier_ User.

Por qué: un registro público o un seed parcial dejaba la DB sin el admin de Marco.

Qué no hacer: no usar `findMany()` sin filtro de email para decidir si crear al admin.

### 2026-09-21 — Company del admin como registro

Qué: `createUserAdmin` llama `provisionSignupCompany` si el user no tiene empresa. Roles: `admin` + `admin_company` + `vendedor`.

Por qué: sin company el seed dejaba un admin que no podía usar el CRM.

Qué no hacer: no crear la company antes de `createSaasPlan`; el hook de `SaasCompany` busca el plan free.
