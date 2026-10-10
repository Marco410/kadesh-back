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
