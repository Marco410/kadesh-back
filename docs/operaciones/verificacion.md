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

## Fase 3a — lo que ya se probó (2026-10-11, copia desechable)

La copia se sembró con `seed.ts` y la prueba creó su propio cliente de ejemplo. 25 de 25:

- Sesiones: un token nuevo vale con el guardián y lleva `sessionVersion`.
- Prueba gratuita: el fin guardado manda; extender +7 días reactiva una prueba vencida y quita el bloqueo "plan gratuito vencido"; extender hasta una fecha; días fuera de rango, planes de pago y no-admins se rechazan; cada extensión queda en Actividad.
- Dueño de cuenta: solo personas de Kadesh; "Mis cuentas" filtra; el cliente no puede leer su dueño de cuenta.
- Notas: el autor lo pone el servidor aunque se mande otro; un cliente no las ve; agregar y borrar quedan en Actividad sin el texto.
- Resumen diario: sin el secreto no corre; la fila del día cuenta extracciones (y fallidas), leads nuevos y de la base, minutos, personas y cambios del CRM; repetirlo no duplica.
- Tendencia: 12 semanas, suma lo del resumen, comparación con el plan; un cliente no puede leerla.

En el navegador (front copiado en otro puerto contra el back de la copia; los servidores locales no se tocaron): ficha con **Extender prueba** y **Dueño de cuenta**, diálogo de extender prueba, sección **Notas** (se guardó una nota fijada desde la interfaz), tendencia y comparación en Resumen, filtro **Mis cuentas**, Actividad → Kadesh con los eventos nuevos; a 390 px sin scroll horizontal y en modo oscuro.

## Fase 3b — lo que ya se probó (2026-10-11, copia desechable)

Prueba de humo, 32 de 32: login normal; suspender persona cierra su sesión y bloquea el login con mensaje claro (con contraseña mala no revela la suspensión); reactivar devuelve el acceso y los tokens viejos siguen sin valer; no se puede suspender una empresa con equipo de Kadesh; suspender empresa saca a todo el equipo; cerrar sesiones de una persona o de una empresa (sin sacar al admin que lo hace); "entrar como" da un token de una hora marcado como tal, uno vencido no vale, lo que navega el admin no cuenta como uso, inicio y fin quedan con el admin como actor; transferir la propiedad; exportar con CLABE enmascarada; anonimizar (correo equivocado rechazado; nombre, correo, CLABE, contraseña, empresa y roles fuera; sin login; su nombre sale de otros eventos de su empresa; accesos sin correo ni IP; blog borrado; no se anonimiza dos veces; el evento no trae datos personales); `customAuth` ya no existe.

Por HTTP contra el back de la copia: con el token de "entrar como" las consultas funcionan, cualquier mutación (sola o mezclada con una permitida) responde `IMPERSONATION_READ_ONLY` con estado 200, `trackEvents` se acepta sin registrar, `endImpersonation` funciona y el token del admin no se ve afectado.

En el navegador: controles de acceso en la ficha, suspender y reactivar la empresa desde la interfaz, pestaña Control de una persona, "ver como" lleva al panel de la persona con la barra (créditos cargan, sin errores ni tour), salir restaura el token del admin y regresa al 360, el login de una persona suspendida muestra el aviso, y la pestaña Control a 390 px sin scroll horizontal.


## Fase 4 — lo que ya se probó (2026-10-11, copia desechable)

Prueba de humo, 64 de 64, sobre una copia sembrada con 7 empresas de ejemplo (sana, uso que cayó, prueba con buen uso, sin créditos el día 5, prueba sin uso, sin plan con intención de compra y una cuenta de prueba interna) y 110 días de resumen diario:

- Salud: lista lista; la cuenta de prueba y las empresas sin plan quedan fuera por defecto; cada empresa sale con el nivel, la tendencia y la señal esperados; orden por riesgo; conteos que cuadran; filtros por señal, por empresa y por búsqueda.
- Empresas: las filas traen salud y se pueden ordenar por salud.
- Inicio: aparecen riesgo de baja y oportunidad de venta sin repetir avisos que ya existían; nada de la cuenta de prueba.
- Activación: tamaño de la cohorte y cada paso con las empresas esperadas; meses que suman la cohorte.
- Retención: meses del más viejo al actual, actividad en el mes correcto, sin la cuenta de prueba.
- Uso: serie hasta ayer, personas activas, MAU, DAU ÷ MAU, módulos por plan, secciones sin el admin ni la cuenta de prueba.
- Demanda: sin cuenta de prueba ni corridas fallidas; huecos de giro + zona correctos; una sola corrida floja no es hueco.
- Adquisición: canales, referido por encima de UTM, "Sin dato", páginas y campañas.
- Las seis consultas nuevas se niegan a quien no es admin de Kadesh.
- Registro: la atribución llega limpia (minúsculas, dominio, ruta sin query, sin llaves extrañas); no se puede colar por `data`; la persona no puede leerla ni editarla.

## Fase 4 — al desplegar

1. `yarn migrate` (por ejemplo, nombre `signup_attribution`). Revisar que la migración solo agregue la columna `signupAttribution` a `User`.
2. **Back antes que front.** El front nuevo manda `attribution` al registrarse; si el back todavía no la acepta, el front reintenta sin ella (el registro no se rompe), pero el dato se pierde.
3. Para tener salud y uso con historia: `pnpm usage:rollup --from=AAAA-MM-DD --to=AAAA-MM-DD` (por ejemplo, los últimos 90 días). Sin resumen diario la salud no se muestra.
4. Registrarse en una ventana privada entrando con `?utm_source=prueba&utm_campaign=prueba`: Operaciones → Analítica → Adquisición muestra el canal "prueba".
5. Aviso de privacidad: mencionar la atribución de registro (UTM, sitio de origen y página de entrada).
