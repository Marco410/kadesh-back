# Créditos (mutaciones)

GraphQL de recarga y saldo. El ledger y el periodo mensual viven en `utils/saas/companyCredits.ts`.

## Superficie

| Mutación | Quién | Qué |
| --- | --- | --- |
| `purchaseCredits` | admin de la empresa (pago Stripe) | Compra un paquete y llama `grantPurchaseCredits` |
| `grantAdminCredits` | solo `Role.ADMIN` (operaciones) | Regala créditos extra **sin cobro** |
| `remainingCredits` | sesión; admin de plataforma puede pasar `companyId` | Saldo del mes actual |

## Invariantes

- Otorgar créditos extra **siempre** pasa por `grantPurchaseCredits`: suma al bonus permanente de la empresa (`purchasedBonusCredits`) y al periodo del mes.
- Una **compra** deja el ledger en `GRANT_PURCHASE` + `referenceType: payment`.
- Un **regalo de operaciones** deja `GRANT_ADMIN` + `referenceType: admin` (el `referenceId` es el user de plataforma). No reutilizar `payment`.
- No actualizar a mano `bonusAllowance` ni `purchasedBonusCredits` desde el panel: el mes siguiente perdería el extra o el ledger quedaría incompleto.
- `admin_company` no puede auto-regalarse créditos. Solo compra o espera el ciclo.

## Decisiones

### 2026-09-18 — Regalo desde operaciones

El dashboard de `/panel/clientes/admin` (pestaña Planes → Ajustar) muestra el saldo y permite agregar créditos. Misma semántica que una recarga: extra de este mes **y** se reaplican cada mes. Tope 50 000 por llamada para evitar un typo.

### 2026-09-18 — Ledger distinto de una compra

`grantAdminCredits` no escribe `payment`. Usa `GRANT_ADMIN` / `admin` para que en Keystone no se confunda con una recarga Stripe.
