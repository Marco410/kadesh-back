# Operaciones: control y auditoría de clientes

Backend de la pantalla **Operaciones** del front (`/panel/clientes/admin`, solo admin de plataforma). El objetivo es que Kadesh vea cada empresa en 360° (plan y pagos, equipo, CRM, consumo, integraciones y actividad) y pueda auditar lo que hacen sus usuarios, con datos en los que se pueda confiar.

## Estado

| Fase | Qué | Estado |
| --- | --- | --- |
| **0** | Cerrar huecos de acceso: los clientes ya no pueden editar créditos, suscripción, pagos ni logs | Código listo |
| **1** | Queries admin (`adminCompanies`, `adminOpsSummary`, `adminCompanyInsights`, `adminActivityFeed`), admin lee cotizaciones/proyectos, login con contraseña registrado en el servidor | Código listo |
| **2** | Modelo de eventos propio (`ActivityEvent`), tiempo activo (`UserActivityDay`), IP y navegador en accesos, instrumentación, webhook de Stripe, registro de qué abre el admin | Migrado (`20261011055848_activity_events_migration`) |
| **3a** | Extender prueba, dueño de cuenta, notas internas, resumen diario de uso (`rollupDailyUsage`) con tendencia y comparación por plan | Migrado (`20261011070506_suspended_migration`) |
| **3b** | Suspender empresa o persona, cerrar sesiones, "entrar como" (solo lectura), transferir la propiedad, ARCO (exportar y anonimizar), quitar `customAuth` | Migrado junto con 3a (`20261011070506_suspended_migration`) |
| **5** | Velocidad comercial: historial de etapas (`TechLeadStageChange`), `adminSalesVelocity` (cierre, ciclo, primer contacto, WhatsApp, estancados) y errores por empresa (`app.error`) | Código listo. **Falta `yarn migrate`** y `pnpm pipeline:backfill --apply` |
| **4** | Analítica: salud de cada cuenta con riesgo de baja y oportunidad de venta, activación, retención por mes de registro, DAU/WAU/MAU y módulos por plan, demanda no cubierta, de dónde llegan los clientes (`User.signupAttribution`) | Código listo. **Falta `yarn migrate`** |

Las fases 0 y 1 no cambian el schema de Prisma. La 2 sí: dos tablas nuevas (`ActivityEvent`, `UserActivityDay`) y dos columnas en `UserAuthLog` (`ip`, `userAgent`). La 3 agrega `SaasCompanyNote`, `SaasCompanyDailyUsage`, `SaasCompany.accountManager` y los campos de control de cuenta (`suspendedAt`, `suspendedReason`, `sessionVersion`, `anonymizedAt`). La 4 solo agrega `User.signupAttribution`.

## Documentos

- [Decisiones](./decisiones.md): qué se cambió y por qué.
- [Verificación](./verificacion.md): cómo se probó y qué revisar al desplegar.

## Código

- Queries admin: [`graphql/customs/queries/admin`](../../graphql/customs/queries/admin/README.md)
- Login con contraseña auditado: `graphql/customs/mutations/auth/passwordLoginAudit.ts` (se conecta en `graphql/extendedSchema.ts`)
- Helper de sesión para checkout: `canActForEmail` en `utils/access/tenant.ts`
- Access endurecido: `*.access.ts` de `SaasCredit`, `SaasCompanySubscription`, `SaasCompanyCreditLedger`, `SaasCompanyCreditPeriod`, `SaasCompanyMonthlyLeadSync`, `SaasPayment`, `SaasReferralCommission`, `TechLeadSyncLog`, `SaasSubscriptionLog`, `UserAuthLog`

- Fase 2:
  - Modelo y reglas: [`models/ActivityEvent/README.md`](../../models/ActivityEvent/README.md)
  - Escritura: `utils/activity/logActivity.ts`; hooks de lists: `utils/activity/listActivityHooks.ts` (se aplican en `models/schema.ts`)
  - Eventos del navegador y latido: `graphql/customs/mutations/activity/trackEvents.ts`
  - Webhook de Stripe: `webhooks/stripe.ts`; sincronización de estado compartida: `utils/saas/stripeSubscriptionSync.ts`
  - Retención: `pnpm activity:prune`

- Fase 4:
  - Salud: `utils/analytics/health.ts` (regla) y `graphql/customs/queries/admin/healthData.ts` (datos de muchas empresas en pocas consultas)
  - Pasos de activación compartidos: `graphql/customs/queries/admin/milestones.ts`
  - Atribución: `utils/analytics/attribution.ts`
  - Queries: `adminHealth`, `adminActivationFunnel`, `adminCohorts`, `adminEngagement`, `adminDemandGaps`, `adminAcquisition` (ver el README de queries admin)

## Orden de despliegue

1. **Back primero.** Si sale primero el front, durante ese rato los logins con contraseña no quedan registrados: el front ya no escribe `UserAuthLog`.
2. Front después. Mientras el front viejo siga en línea, su `createUserAuthLog` falla con "Access denied". Es inofensivo porque nunca bloqueó el login.

### Fase 2

1. **`yarn migrate` antes de levantar el back con este código** (en local: antes de `yarn dev`). `keystone dev` hace `db push` al arrancar: si arranca primero, crea las tablas sin migración y después `migrate dev` detecta *drift* y pide resetear la base.
2. En producción, la migración se aplica antes de iniciar la versión nueva. Sin ella fallan las escrituras de `UserAuthLog` (columnas nuevas).
3. Back antes que front: el front nuevo pide campos (`usage`, `lastSeenAt`) que el back viejo no tiene.
4. Stripe, **después** de que el back nuevo esté en línea: crear el destino `https://kadesh-back-production.up.railway.app/webhooks/stripe` (sin `/api/v1`) con los eventos `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` y `charge.refunded`, estilo *snapshot*, versión `2025-05-28.basil`. Poner su *Signing secret* en `STRIPE_WEBHOOK_SECRET` (Railway → kadesh-back → Variables). Sin esa variable el webhook responde 503 y no procesa nada.
5. Programar `pnpm activity:prune --apply` una vez al mes.
6. Fase 3: el workflow `.github/workflows/rollup-daily-usage.yml` llama `rollupDailyUsage` cada noche con los mismos secrets que los posts programados (`KADESH_API_URL`, `CRON_SECRET`). Para llenar semanas pasadas: `pnpm usage:rollup --from=AAAA-MM-DD --to=AAAA-MM-DD`.
7. Aviso de privacidad y Términos: mencionar el registro de uso (secciones, tiempo activo), IP y navegador en accesos, y la analítica agregada.

### Fase 5

1. `yarn migrate` antes de levantar el back (crea `TechLeadStageChange`).
2. `pnpm pipeline:backfill` para ver cuántos cambios de etapa se recuperan de `ActivityEvent` y `--apply` para guardarlos.
3. Back antes que front (el front pide `adminSalesVelocity` y `appErrors`).

### Fase 4

1. `yarn migrate` antes de levantar el back (agrega `User.signupAttribution`).
2. Back antes que front. Si el front sale primero, el registro no se rompe (reintenta sin `attribution`), pero esos registros quedan sin origen.
3. Llenar el resumen diario hacia atrás (`pnpm usage:rollup --from --to`) para que la salud y el uso tengan historia.
4. Aviso de privacidad: agregar la atribución de registro.
