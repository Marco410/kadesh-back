# Operaciones: control y auditoría de clientes

Backend de la pantalla **Operaciones** del front (`/panel/clientes/admin`, solo admin de plataforma). El objetivo es que Kadesh vea cada empresa en 360° (plan y pagos, equipo, CRM, consumo, integraciones y actividad) y pueda auditar lo que hacen sus usuarios, con datos en los que se pueda confiar.

## Estado

| Fase | Qué | Estado |
| --- | --- | --- |
| **0** | Cerrar huecos de acceso: los clientes ya no pueden editar créditos, suscripción, pagos ni logs | Código listo |
| **1** | Queries admin (`adminCompanies`, `adminOpsSummary`, `adminCompanyInsights`, `adminActivityFeed`), admin lee cotizaciones/proyectos, login con contraseña registrado en el servidor | Código listo |
| **2** | Modelo de eventos propio (`ActivityEvent`), instrumentación, webhook de Stripe, registro de qué empresas ve el admin | Pendiente (requiere `yarn migrate`) |

Ninguna fase de 0 y 1 cambia el schema de Prisma: no hace falta migrar.

## Documentos

- [Decisiones](./decisiones.md): qué se cambió y por qué.
- [Verificación](./verificacion.md): cómo se probó y qué revisar al desplegar.

## Código

- Queries admin: [`graphql/customs/queries/admin`](../../graphql/customs/queries/admin/README.md)
- Login con contraseña auditado: `graphql/customs/mutations/auth/passwordLoginAudit.ts` (se conecta en `graphql/extendedSchema.ts`)
- Helper de sesión para checkout: `canActForEmail` en `utils/access/tenant.ts`
- Access endurecido: `*.access.ts` de `SaasCredit`, `SaasCompanySubscription`, `SaasCompanyCreditLedger`, `SaasCompanyCreditPeriod`, `SaasCompanyMonthlyLeadSync`, `SaasPayment`, `SaasReferralCommission`, `TechLeadSyncLog`, `SaasSubscriptionLog`, `UserAuthLog`

## Orden de despliegue

1. **Back primero.** Si sale primero el front, durante ese rato los logins con contraseña no quedan registrados: el front ya no escribe `UserAuthLog`.
2. Front después. Mientras el front viejo siga en línea, su `createUserAuthLog` falla con "Access denied". Es inofensivo porque nunca bloqueó el login.
