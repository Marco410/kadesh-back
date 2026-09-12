# Queries/mutaciones de digest y playbook

Capa GraphQL de las features de IA (Inicio). Snapshots y caché viven en `utils/ai/dailyDigest.ts` y `utils/ai/playbook.ts`. Settings: [`../mutations/ai`](../mutations/ai/README.md). Runtime: [`utils/ai`](../../../utils/ai/README.md).

## Superficie

| Campo | Tipo | Qué |
| --- | --- | --- |
| `dailyDigest` | query | Lee el insight del día (caché). |
| `generateDailyDigest(force)` | mutation | Genera o reusa el digest. |
| `aiPlaybook` / `generateAiPlaybook` | query / mutation | Playbook de perfil, misma forma de resultado. |

Access: `canUseCompanyAi` (miembro de la empresa o admin de plataforma). Configurar la key es otro permiso (`canManageCompanyAi`).

## Invariantes

- Caché en `TechAiInsight` por `company` + `kind` + `referenceKey`.
- Admin de empresa / plataforma: digest de **empresa** (`salesPerson: null`). Vendedor: digest **suyo**.
- `force: true` regenera. Errores de proveedor/créditos/rate limit salen por `friendlyAiError` (mensaje de usuario, sin stack).
- En managed, un digest típico cuesta créditos (tokens). Un 429 de Gemini puede resolverse por fallback de modelo **dentro** de `callCompanyAi`; si la cadena entera se agota, el cliente ve `AiRateLimitError`.

## Decisiones

### 2026-09-11 — Alcance admin vs vendedor

El plan decía “el vendedor abre Inicio”. El dashboard de `admin_company` es el pipeline de toda la empresa, así que su digest no se guarda atado a un vendedor. Misma mutación, distinta clave de caché.

Cualquier miembro puede **generar**; solo el admin de empresa configura modalidad / API key.
