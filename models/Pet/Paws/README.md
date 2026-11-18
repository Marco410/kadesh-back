# Paws (huellitas)

Puntos que gana una persona por ayudar en Kadesh Pet: publicar un reporte, avisar que vio a un animal, cerrar su caso, adoptar. Con ellos sube de nivel, mantiene una racha semanal y aparece en el ranking público. No son los créditos del SaaS (`models/Saas/SaasCompanyCreditLedger`): son por persona, no por empresa, y no se compran.

Fase 1 (lo que hay): ganar, niveles, racha, ranking, backfill. El canje por promociones o descuentos es la fase 2; el libro ya acepta movimientos `spend`, pero nada los escribe todavía.

## Piezas

| Qué | Dónde |
|---|---|
| Reglas: puntos, topes, niveles, bono de racha | `constants.ts` (cambiarlas no requiere migración) |
| Saldo por persona | `PawAccount` |
| Libro de movimientos | `PawTransaction` |
| Motor: la única escritura | `utils/pet/paws.ts` |
| Qué acción premia a quién y cuándo se quita | `utils/pet/pawsTriggers.ts` |
| Consultas | `myPaws`, `myPawHistory`, `pawLeaderboard` (`graphql/customs/queries/`) |
| Mutaciones | `setPawRankingVisibility` (`mutations/pet/paws.ts`), `adminAdjustPaws` (`mutations/admin/paws.ts`) |
| Historial previo | `scripts/backfillPaws.ts` (`pnpm paws:backfill`) |

Apagado hasta poner `PAWS_ENABLED=true`. Apagado, nada premia ni revierte, `myPaws` responde `enabled: false` y el ranking sale vacío.

## Invariantes

- **Solo el motor escribe.** Las dos lists no tienen create, update ni delete por API (ni en el Admin UI). Una persona lee solo sus filas.
- **Un premio o una reversa es una sola sentencia SQL**: valida a la persona y los topes, mueve el saldo con un incremento atómico y agrega la fila del libro con el saldo resultante. `PawAccount.balance` siempre es la suma de `PawTransaction.amount` de esa persona.
- **`sourceKey` dice qué se premió** (`report:<animalId>`, `sighting:<userId>:<animalId>`…). Mientras sus filas sumen más de cero, no vuelve a premiar. `key` es `<sourceKey>#<n>` y es único: dos peticiones a la vez por el mismo premio no pueden ganar las dos.
- **La llave de un reporte no lleva a su dueño.** `resolveAnimalClaim` cambia `Animal.user`; con el usuario en la llave el mismo reporte premiaría dos veces.
- **El libro no se edita ni se borra.** Un error se corrige con otra fila (reversa o `adminAdjustPaws`).
- **El nivel no se guarda**: sale de `pawLevelFor(lifetimeEarned)`. `lifetimeEarned` baja con una reversa, nunca con un gasto.
- **La racha caduca al leer** (`currentStreakWeeks`): sin una acción esta semana ni la pasada, vale 0. No hay cron.
- **No ganan ni salen en el ranking**: admins de plataforma, la cuenta de automatización, cuentas de prueba, suspendidas y anonimizadas.
- **Los disparadores nunca frenan ni rompen la acción**: se llaman con `void` y no lanzan.

## Reglas contra el abuso

- Topes por acción y por día de CDMX, y un tope global de 60 al día. Se cuentan en la base, no en memoria (los límites de `utils/security/rateLimit.ts` se reinician en cada deploy).
- Sin autointeracción: avistar o comentar tu propio reporte, o reseñar tu propio lugar, no da nada.
- Cerrar un caso da lo mismo con cualquier desenlace. El bono grande va a lo que confirma otra persona: reclamo aprobado (`reunion_helped`) y adopción completada.
- Un caso debe llevar 6 h abierto para que cerrarlo dé huellitas.
- Tres avistamientos revertidos en 30 días apagan ese premio para la cuenta.
- Likes, favoritos, «me interesa» y vistas no dan nada: no tienen límite de uno por persona.

Queda sin cubrir: dos cuentas coludidas en un reclamo o una adopción. Está limitado a 1 al día y se corrige con `adminAdjustPaws`.

## Decisiones

### 2026-11-17 — sistema de huellitas

Qué: lists `PawAccount` y `PawTransaction`, motor en SQL crudo y disparadores explícitos en cada acción.

Por qué:
- **SQL crudo y no `prisma.$transaction`**: el `context.prisma` de Keystone devuelve los errores como valor en vez de lanzarlos, así que una transacción interactiva no se revierte sola, y ocupa 1 de las 5 conexiones entre viajes.
- **No se copió `utils/saas/companyCredits.ts`**: sus otorgamientos leen, suman en JS y escriben, sin llave de idempotencia.
- **Disparadores explícitos y no `utils/pet/petActivity.ts` como punto único**: la actividad registra el alta del animal y no su primer registro (que es cuando de verdad se publica), salta sudo, y su actor es la sesión cuando en varios casos gana otra persona (reclamo, adopción, verificación).
- **Racha semanal y no diaria**: nadie ayuda con una mascota perdida todos los días; una racha diaria empuja a inventar acciones.
- **Se guarda el lunes de la semana** (`streakWeekStart`) y no la semana ISO: restarle 7 días no falla en el cambio de año.

Qué no hacer:
- No escribir estas tablas fuera de `utils/pet/paws.ts`, ni editar `balance` a mano.
- No pedir el nivel como campo virtual ni por fila: `getPawLevels(userIds)` lo trae en una consulta.
- No dar huellitas por acciones sin límite de uno por persona.
- No premiar más un desenlace que otro.
- No conectar la insignia de nivel a `getNearbyAnimals` sin medirlo: es la consulta pública más visitada.

## Pendientes

- Fase 2: ofertas de aliados y canje (movimientos `spend`).
- Si el libro pasa de unas 200 mil filas al mes, el ranking mensual necesita un resumen por mes.
- Las adopciones anteriores al sistema no entraron al backfill: no hay registro limpio de quién adoptó.
- Los fronts y la app deben conocer el tipo de notificación `paws.level_up` (enlaza a `/perfil?tab=paws`).
