# Queries/mutaciones de digest y playbook

Capa GraphQL de las features de IA (Inicio). Snapshots y caché viven en `utils/ai/dailyDigest.ts` y `utils/ai/playbook.ts`. Settings: [`../mutations/ai`](../mutations/ai/README.md). Runtime: [`utils/ai`](../../../utils/ai/README.md).

## Superficie

| Campo | Tipo | Qué |
| --- | --- | --- |
| `dailyDigest` | query | Lee el insight del día (caché). |
| `generateDailyDigest(force)` | mutation | Genera o reusa el digest. |
| `aiPlaybook` / `generateAiPlaybook` | query / mutation | Playbook de perfil, misma forma de resultado. |
| `marketInsight` / `generateMarketInsight` | query / mutation | Análisis de mercado (DENUE + BIE). Caché mensual por zona. |

Access: `canUseCompanyAi` (miembro de la empresa o admin de plataforma). Configurar la key es otro permiso (`canManageCompanyAi`).

`generateMarketInsight` usa el mismo gate. El snapshot lo arma [`utils/ai/marketSnapshot.ts`](../../../utils/ai/marketSnapshot.ts).


## Invariantes

- Caché en `TechAiInsight` por `company` + `kind` + `referenceKey`.
- Admin de empresa / plataforma: digest de **empresa** (`salesPerson: null`). Vendedor: digest **suyo**.
- `force: true` regenera. Errores de proveedor/créditos/rate limit salen por `friendlyAiError` (mensaje de usuario, sin stack).
- En managed, un digest típico cuesta créditos (tokens). Un 429 de Gemini puede resolverse por fallback de modelo **dentro** de `callCompanyAi`; si la cadena entera se agota, el cliente ve `AiRateLimitError`.

## Decisiones

### 2026-09-11 — Alcance admin vs vendedor

El plan decía “el vendedor abre Inicio”. El dashboard de `admin_company` es el pipeline de toda la empresa, así que su digest no se guarda atado a un vendedor. Misma mutación, distinta clave de caché.

### 2026-10-28 — Respaldo del digest con clientes reales

Si el modelo devuelve menos de 3 pasos válidos, antes se rellenaba con un texto fijo que decía “No pude estructurar 3 pasos automáticos…”. Al usuario le sonaba a error y no le decía qué hacer. Ahora `fallbackDigestActions` (`utils/ai/dailyDigest.ts`) arma los pasos que faltan con los clientes del snapshot, en el orden de prioridad del prompt (seguimientos vencidos → cotizaciones sin respuesta → sin primer contacto → leads fríos; primero uno de cada tipo). No inventa nombres, salta a quien el modelo ya mencionó y, si el pipeline no alcanza, cierra con pasos de prospección. Nunca menciona que la IA falló. Los títulos usan verbos que el front reconoce para ponerles tipo y enlace (`classifyAiAction` en kadesh-business).

### 2026-09-14 — Análisis de mercado

Misma forma query/mutation + `force` que el digest. Caché `company + kind + referenceKey` mensual. No mezclar con el digest del vendedor (`salesPerson` vacío = insight de empresa).

