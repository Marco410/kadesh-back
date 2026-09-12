# SaasPlan

Catálogo de planes (Free, Starter, Pro, Agencia). El JSON `plan_features.json` es la lista canónica de features; `getPlanFeatures()` arma el array `{ key, name, description, included }` que se guarda en `SaasPlan.planFeatures` y se **copia** a `SaasCompanySubscription.planFeatures` al contratar.

## Invariantes

- Key en `snake_case`. El front y el backend chequean `key` (p. ej. `add_own_leads`, `kadesh_ai`).
- `getPlanFeatures(mapa)`: si una key no está en el mapa, `included` es **true**. Free y Agencia llaman `getPlanFeatures()` (todo incluido). Starter/Pro pasan el mapa en `utils/seed/saas_plan.ts`.
- La suscripción es un snapshot. Cambiar el plan **no** actualiza empresas ya contratadas hasta re-seed del plan + actualizar (o recrear) la suscripción.
- Tras editar `plan_features.json` o el seed, el humano corre `yarn db:seed` (o edita los JSON en Admin). No hay migración SQL: `planFeatures` es un campo json.

## Decisiones

### 2026-09-12 — `kadesh_ai` en todos los planes

Kadesh AI entra al catálogo y va **incluida** en Free, Starter, Pro y Agencia. El cupo de uso managed sigue siendo la bolsa de créditos del plan, no un feature flag distinto. BYOK no consume créditos.
