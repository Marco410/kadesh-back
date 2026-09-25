# updatePlanFeatureCatalog

Sincroniza **nombre** y **descripción** de módulos en todos los `SaasPlan` y en las `SaasCompanySubscription` existentes. No toca `included` (eso es por plan).

## Acceso

Solo `Role.ADMIN` (Operaciones).

## Contrato

Input: lista de `{ key, name, description }`. Por cada plan/suscripción, si tiene esa `key` en su JSON `planFeatures`, actualiza name/description y deja el resto igual. No agrega keys nuevas.

## Invariantes

- No escribe `plan_features.json` (sigue siendo seed/fallback).
- No crea ni borra features; solo copy compartido.
- Si nada cambió, `success: true` con mensaje de “sin cambios”.

## Decisiones

### 2026-09-25 — Copy global, included por plan

Editar el texto desde un plan concreto confundía (Free se veía, Starter mensual no, porque precios a veces leía el anual). Operaciones edita el catálogo una vez; el included sigue en el editor de cada plan.
