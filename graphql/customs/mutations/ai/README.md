# Mutaciones de settings de IA

GraphQL para configurar y probar la IA de una `SaasCompany`. La ejecución real está en [`utils/ai`](../../../../utils/ai/README.md).

## Superficie

| Mutación | Quién | Qué |
| --- | --- | --- |
| `updateCompanyAiSettings` | `admin_company` del tenant, o `admin` de plataforma | `billingMode`, `provider`, `apiKey`, `model` |
| `testCompanyAiConnection` | igual | ping vía `callCompanyAi({ bill: false })` |

La key **nunca** se lee por GraphQL. Solo se escribe cifrada (`aiApiKeyEncrypted`) y se expone `aiApiKeyPreview` (enmascarada).

## Access (`access.ts`)

- `canManageCompanyAi` — settings y ping.
- `canUseCompanyAi` — features (digest, playbook): cualquier miembro de la empresa o admin de plataforma.
- No confiar en `companyId` del cliente para “ser de otra empresa”: comparar con `getSessionCompanyId(session)` (el admin de plataforma se salta el tenant).

## Decisiones

### 2026-09-10 — `billingMode` en el mismo save

El frontend de Fase 1 persiste BYOK vs managed junto con provider/key/model. Input opcional `billingMode`.

### 2026-09-10 — Ping sin créditos

En managed el ping no vale un crédito. En BYOK el gasto es del proveedor del tenant.

### 2026-09-11 — Platform admin vs tenant

`Role.ADMIN` configura cualquier empresa. `admin_company` solo la suya. Usar IA (`canUseCompanyAi`) es de cualquier usuario de esa empresa.
