# Ledger de créditos de empresa

Movimientos de saldo (`SaasCompanyCreditLedger`). Lo escribe `utils/saas/companyCredits.ts`, no el admin a mano.

## Invariantes

- `amount` es con signo: positivo = grant, negativo = consume.
- `referenceType` dice **de dónde vino** el movimiento; no reutilizar `payment` si no hubo cobro.

| type | referenceType | Quién |
| --- | --- | --- |
| `GRANT_PLAN` | `subscription` | Cupo del plan / cambio de plan |
| `GRANT_PURCHASE` | `payment` | Recarga Stripe |
| `GRANT_PURCHASE` | `company` | Bonus permanente al abrir el periodo del mes |
| `GRANT_ADMIN` | `admin` | Operaciones (`grantAdminCredits`). `referenceId` = user admin |
| `CONSUME_SYNC` | `sync` | Extracción de leads |
| `CONSUME_AI` | `ai` | IA managed |
| `ADJUST` | — | Ajuste excepcional |

## Decisiones

### 2026-09-18 — Grant admin

Regalar créditos desde `/panel/clientes/admin` no es una compra. Tipo `GRANT_ADMIN` y `referenceType: admin` para no mezclarlo con Stripe (`payment` / `GRANT_PURCHASE`).
