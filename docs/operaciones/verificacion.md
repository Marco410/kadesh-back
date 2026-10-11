# Verificación — Operaciones

## Lo que ya se probó (2026-10-10, base local)

Script de humo con `getContext(config, PrismaModule)` y `context.graphql.run`, igual que `seed.ts`, contra la base de `docker compose` (puerto 5433):

- `tsc --noEmit` sin errores.
- El schema GraphQL extendido arma sin errores (tipos `Admin*`, scalar `JSON`).
- Como admin de plataforma:
  - `adminCompanies` (búsqueda, filtro por estado, orden por actividad o nombre);
  - `adminOpsSummary`;
  - `adminCompanyInsights` (equipo, pipeline, serie diaria de créditos, IA, CRM, WhatsApp, calendario);
  - `adminActivityFeed` (global, por empresa, por persona, por tipo, solo errores, búsqueda y segunda página con `before`).
- Como usuario sin rol admin: las cuatro queries responden "Solo un administrador de Kadesh…".
- El admin ve cotizaciones de otras empresas; un usuario sin empresa ve `[]`.
- `authenticateUserWithPassword` con credenciales malas responde `Failure` y deja un `UserAuthLog` `CUSTOM_AUTH_FAIL` escrito por el servidor (el registro de prueba se borró).
- Como miembro de empresa (rol `gerencia`), todas responden "Access denied": `updateSaasCredit`, `updateSaasCompanySubscription`, `updateSaasCompanyCreditLedger`, `updateSaasCompanyCreditPeriod`, `deleteTechLeadSyncLog`.
- Sin sesión: `updateSaasCredit` y `createUserAuthLog` responden "Access denied".
- El miembro sigue leyendo su suscripción, su ledger y los paquetes de créditos.
- `syncBusinessLeadsFromGoogle` como miembro responde `success: false` con el mensaje de solo admin.

## Al desplegar

1. Back antes que front (ver [README](./README.md)).
2. En modo test de Stripe:
   - contratar un plan desde el panel: debe salir bien y dejar `SUCCESS` en `SaasSubscriptionLog`;
   - comprar créditos: debe dejar `CREDIT_SUCCESS` (antes no quedaba nada).
3. Iniciar sesión con contraseña:
   - aparece un `UserAuthLog` `CUSTOM_AUTH_LOGIN`;
   - `lastLoginAt` se actualiza;
   - con una contraseña mala queda `CUSTOM_AUTH_FAIL` ligado a la cuenta.
4. Extracción B2B: corre igual y no hay peticiones a `127.0.0.1:7352`.
5. Admin de Keystone: el importador de leads de Google sigue funcionando para el admin.

## Fase 2 — lo que ya se probó (2026-10-10, copia desechable de la base)

Se clonó la base local en `k_app_f2_sandbox`, se le aplicó el schema nuevo con `prisma db push` (solo a la copia) y se borró al terminar. La base real y el historial de migraciones no se tocaron.

- `tsc --noEmit` sin errores; `keystone build` genera `schema.prisma` y `schema.graphql` con las tablas y campos nuevos.
- Prueba de humo con `getContext`, 36 de 36:
  - `logActivity`: categoría, actor, empresa, origen, IP y navegador; la metadata oculta `password` y `apiKey`.
  - Hooks: una persona mueve un lead → `lead.status_changed` con antes y después; el mismo cambio con sudo no deja evento; el admin de Kadesh editando otra empresa → origen `admin`; cambio de roles con la foto previa (antes → después); editar el propio onboarding no deja ruido.
  - `trackEvents`: acepta vistas y un latido, rechaza `admin.*` de un no-admin y tipos desconocidos; metadata plana; el primer latido crea el día con 5 minutos y uno seguido no suma; `admin.viewed_company` se guarda una vez en 10 minutos con el nombre de la empresa.
  - Feed: trae eventos propios, sin filtro no trae navegación, navegación solo si se pide, tipo Equipo con cambios de roles, por persona incluye lo que le hicieron a su cuenta, un usuario normal no puede leerlo.
  - `adminCompanyInsights.usage` (minutos, secciones) y por persona (`lastSeenAt`, minutos, cambios); `adminOpsSummary`; `adminCompanies.lastSeenAt` y orden por actividad con el latido.
  - Webhook por HTTP: firma válida → 200, inválida → 400; `invoice.paid` crea el cobro, mueve el fin de periodo y registra la renovación; repetirlo no duplica. Con el formato nuevo de la API, `invoice.payment_failed` crea el cobro fallido. `subscription.updated` → `past_due`; un `invoice.paid` después la regresa a activa; `charge.refunded` y `subscription.deleted` funcionan. En el feed el cobro fallido sale una sola vez.
  - `subscriptionStatus` con Stripe respondiendo error: la suscripción sigue activa.
  - Reembolso con formato `basil` (cargo sin `invoice`): se busca la factura del PaymentIntent en Stripe (respuesta simulada) y el cobro guardado con el id de la factura queda `refunded` con su evento.
  - Un consumo que deja el mes en 0 registra `credits.exhausted`.
- En el navegador (front local contra el back apuntando a la copia): el panel del cliente manda sección, latido y módulo bloqueado en un lote; Operaciones muestra "Cómo usan el panel" en el 360, tiempo activo en Equipo, el filtro Navegación con nombres de sección y el registro del admin en Kadesh; a 390 px sin scroll horizontal y en modo oscuro.

## Fase 2 — al desplegar

1. `yarn migrate` (por ejemplo, nombre `activity_events`) **antes** de levantar el back. Revisar que la migración solo cree `ActivityEvent`, `UserActivityDay` y las columnas `ip` / `userAgent` de `UserAuthLog`.
2. Iniciar sesión: el `UserAuthLog` trae IP y navegador.
3. Mover un lead de etapa: Operaciones → Actividad → CRM muestra "Movió … de … a …".
4. Abrir el 360 de una empresa: Actividad → Kadesh muestra "Abrió el 360 de …".
5. Dejar el panel abierto 10 minutos: el 360 → Equipo muestra minutos activos.
6. Stripe en modo test, con el endpoint dado de alta y `STRIPE_WEBHOOK_SECRET`:
   - `stripe listen --forward-to localhost:3002/webhooks/stripe` y `stripe trigger invoice.payment_failed`;
   - o desde el Dashboard, "Enviar evento de prueba". Los eventos de suscripciones que no existen en Kadesh se ignoran (responden 200).
7. `pnpm activity:prune` muestra el conteo sin borrar.
