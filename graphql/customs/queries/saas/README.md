# Queries SaaS (Stripe / suscripción)

Queries custom del dominio SaaS que no caben en lists Keystone.

## `stripePlanCheck`

Compara un `SaasPlan` (o el borrador que se va a guardar) con el Price de Stripe ligado. Solo **lectura**: no crea ni edita Prices.

### Acceso

Solo `Role.ADMIN` (operaciones). Cualquier otro rol recibe `success: false`.

### Input

- `planId` (obligatorio)
- `stripePriceId`, `cost`, `currency`, `frequency` opcionales: si vienen, se usan como “vas a guardar”; si no, se leen del plan en DB.

### Resultado

Filas `fields` (monto, moneda, frecuencia, precio activo, producto) con `local` / `stripe` / `match`, más `allMatch`, modo live/test y conteo aproximado de suscripciones activas en ese Price.

### Invariantes

- El monto de Kadesh está en unidades mayores (799.5); Stripe usa centavos (`unit_amount`).
- La frecuencia de Kadesh (`monthly` / `annual` / …) se mapea a `recurring.interval` de Stripe.
- Si el Price no existe o falta ID, `success: false` con mensaje usable en UI.

## Decisiones

### 2026-09-25 — Solo verificar, no escribir en Stripe

Operaciones edita el catálogo en Kadesh; Stripe Prices son inmutables. El diálogo del admin confirma el estado y, si no coincide, el humano crea un Price nuevo en el Dashboard y pega el ID. No se usa la API de Stripe para crear/actualizar Prices desde aquí.
