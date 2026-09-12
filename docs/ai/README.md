# Cerebro Kadesh — capa de IA

Documentación viva de la capa de IA de Kadesh Business. Cada empresa (`SaasCompany`) configura IA a nivel tenant (no por usuario) y puede pagar de dos formas: **BYOK** (trae su propia API key) o **administrado por Kadesh** (créditos).

## Estado de implementación

| Fase | Qué es | Estado en este repo |
| --- | --- | --- |
| **0** | Infraestructura: cifrado, proveedores, créditos únicos, log de llamadas, mutaciones de settings | Implementado (migraciones SQL listas, no aplicadas a la DB local) |
| **1** | Cerebro Kadesh: conectar `onboarding*` a IA + settings de empresa | Implementado (backend + UI en `kadesh-business`) |
| **2** | Digest diario de 3 siguientes pasos | Implementado (backend + UI en Inicio) |
| **3** | Narrativa mensual de dashboards | Roadmap |
| **4** | Análisis de archivos → tareas Kanban | Roadmap |

Bitácora: [progreso.md](./progreso.md).

## Documentos

- [Fase 0 — Infraestructura](./fase-0-infraestructura.md)
- [Fase 1 — Cerebro Kadesh](./fase-1-cerebro-kadesh.md)
- [Fase 2 — Digest diario](./fase-2-digest-diario.md)
- [Precio tokens → créditos](./precio-tokens.md)
- [Fases 3–4 — Roadmap](./roadmap-fases-2-4.md)
- [Decisiones](./decisiones.md) — por qué se eligió cada desviación del plan original
- [Verificación](./verificacion.md)

Junto al código (fuente operativa):

- [`utils/ai/README.md`](../../utils/ai/README.md) — `callCompanyAi`, créditos, rate limit, fallback Gemini
- [`graphql/customs/mutations/ai/README.md`](../../graphql/customs/mutations/ai/README.md) — settings y ping
- [`graphql/customs/ai/README.md`](../../graphql/customs/ai/README.md) — digest y playbook

## Idea central

Los campos de onboarding **ya existían** en `SaasCompany`:

- `onboardingMainOffer` — qué vendes
- `onboardingIdealCustomer` — cliente ideal
- `onboardingAvgTicketValue` — ticket / valor
- `onboardingSalesPain` — cómo consigues clientes

La Fase 1 no crea un formulario nuevo de contexto: conecta esos campos a `buildSystemPrompt()` y a las llamadas de `callCompanyAi()`.
