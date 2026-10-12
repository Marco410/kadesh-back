# User

List de cuentas (auth Keystone, roles, company, Stripe, referidos). El registro público de KadeshPet crea un `User` sin sesión.

## Invariantes

- `create` está abierto: cualquiera puede registrarse.
- `query`/`update` exigen sesión y solo ven al propio usuario (admins de company ven compañeros; platform admin ve todo).
- Tras crear un User con email, `userBlogSubscriptionHook` crea o vincula un `BlogSubscription`. Ese side-effect corre con `context.sudo()`: el request de registro no está autenticado y Keystone niega el `connect` a `User` si se usa el context original.
- El `username` se genera en `userNameHook` / `checkUserName` (nombre + apellido, p. ej. `marco.pascual`). Si ya existe, suma `2`, `3`… o un sufijo de tiempo. La búsqueda de ocupados va con `sudo`: sin sesión `User.query` no ve a nadie y Prisma reventaba con unique en `username`.
- `my_appointments` (`PetPlaceAppointment.customer`) son las citas que este usuario reservó como cliente; ver [`../Pet/PetPlace/PetPlaceAppointment/README.md`](../Pet/PetPlace/PetPlaceAppointment/README.md). Distinto de `pet_places`, que son los negocios que reclamó como dueño.

## Decisiones

### 2026-09-14 — BlogSubscription en afterOperation con sudo

Qué: `userBlogSubscriptionHook` usa `context.sudo()` para leer/crear/actualizar `BlogSubscription`.

Por qué: al conectar `BlogSubscription.user`, Keystone exige poder consultar ese `User`. En el registro no hay sesión (`User.query` = deny) y el error era `Access denied: You cannot connect that User`.

Qué no hacer: no volver a usar el `context` del request para este connect; el usuario recién creado no es visible para sí mismo hasta que inicia sesión.

### 2026-09-18 — Username único en registro con sudo

Qué: `checkUserName` consulta usernames ocupados con `context.sudo()` y, si `marco.pascual` ya está, prueba `marco.pascual2`, etc.

Por qué: el registro público no tiene sesión. `User.query` no lista a otros usuarios, el hook creía que el slug estaba libre y Prisma fallaba: `Unique constraint failed on the fields: (\`username\`)`.

Qué no hacer: no usar `context.db.User.findOne` sin sudo para esta comprobación; no devolver el username pedido en create sin verificar unicidad.

### 2026-09-28 — BlogSubscription: email en minúsculas al crear/vincular

Qué: `userBlogSubscriptionHook` normaliza el email a minúsculas y busca con `mode: insensitive` antes de crear o vincular.

Por qué: evita un segundo `BlogSubscription` activo si el usuario ya se había suscrito al blog con otro casing. Ver `models/Blog/BlogSubscription/README.md`.

### 2026-10-07 — Gerencia y `permissions`

Qué: rol `gerencia` en el catálogo; campo JSON `User.permissions` (lista de llaves del panel). Admin de empresa y Gerencia pueden crear usuarios de la empresa y asignar roles/permisos. Gerencia no ve ni edita usuarios con rol `admin` / `admin_company`. Quien no tiene lista de permisos sigue el rol (legado). Catálogo: `auth/permissionsCatalog.ts`. Sesión incluye `permissions`.

Requiere migrate (`permissions` en User) + `pnpm db:seed` (o crear el Role `gerencia` a mano). No lo corre el agente.

Qué no hacer: no dejar que Gerencia conecte `admin_company`; no tratar un array vacío como “legado” (vacío = sin permisos).

### 2026-10-07 — Roles protegidos en seed / register (sin sesión)

Qué: el `resolveInput` de roles solo sanitiza cuando hay sesión firmada. Seed y `registerUser`/`Google` (sudo sin sesión) conservan `admin` / `admin_company`.

Por qué: con sesión ausente el filtro “nunca admin/admin_company” dejaba solo `vendedor` aunque el seed conectara los tres roles.

Qué no hacer: no reintroducir ese filtro para `!session`; el field access de `roles` ya bloquea create/update públicos.

### 2026-10-10 — Accesos y `lastLoginAt` los escribe el servidor

Qué: el login con contraseña (`authenticateUserWithPassword`) se envuelve en `graphql/customs/mutations/auth/passwordLoginAudit.ts`. Escribe `UserAuthLog` (éxito o fallo, con `method: "password"`) y marca `lastLoginAt`. `UserAuthLog.create` por API queda solo para admin de plataforma.

Por qué: antes lo escribía el navegador con un `createUserAuthLog` abierto a cualquiera, así que el historial de accesos de Operaciones se podía falsificar y los logins de Pet no quedaban. Google y el registro ya se registraban en el servidor.

Qué no hacer: no volver a mandar `createUserAuthLog` ni `updateUser({ lastLoginAt })` desde el front. Ver `docs/operaciones/decisiones.md`.


### 2026-10-10 — `UserActivityDay`: tiempo con el panel abierto

Qué: list nueva `User/UserActivityDay`. Una fila por persona y día (hora de CDMX, `key = userId:YYYY-MM-DD` único) con minutos activos, primera y última vez vista. La llena el latido de `trackEvents` (cada 5 min con la pestaña visible). Un latido más seguido que el intervalo actualiza `lastSeenAt` pero no suma minutos, para que nadie infle su tiempo llamando la mutación en bucle.

Por qué: la sesión dura 30 días, así que `lastLoginAt` no dice si alguien usa el panel. Operaciones marcaba como "inactivo" a equipos que entran a diario sin volver a iniciar sesión. Con esta tabla salen el "visto por última vez", los usuarios activos y los minutos de uso por persona.

Lectura y borrado: solo admin de plataforma. Nadie escribe por API.

### 2026-10-10 — `UserAuthLog` guarda IP y navegador

Qué: campos `ip` y `userAgent`, llenados por `writeUserAuthLog` desde la petición (IP del `x-forwarded-for` del proxy si existe).

Por qué: sirven para detectar cuentas compartidas o accesos raros. Son datos personales: el Aviso de privacidad debe mencionarlos.

Requiere `yarn migrate` (junto con `UserActivityDay` y `ActivityEvent`). No lo corre el agente.

### 2026-10-11 — Campos de control de cuenta

Qué: `suspendedAt`, `suspendedReason`, `sessionVersion` (default 0) y `anonymizedAt`. Solo los lee el admin de plataforma y nadie los escribe por API (`userAccountControlFieldAccess`). `auth/sessionGuards.ts` los revisa en cada petición junto con `SaasCompany.suspendedAt`: una sesión con otra `sessionVersion`, suspendida o anonimizada deja de valer. Un admin de plataforma nunca queda fuera por la suspensión de su empresa.

Los escriben las mutaciones de Operaciones (`graphql/customs/mutations/admin/accountControl.ts`): suspender, cerrar sesiones y anonimizar (ARCO). Tokens emitidos antes de este cambio no traen versión y cuentan como 0, así que siguen valiendo. Ver `docs/operaciones/decisiones.md`.


### 2026-10-11 — `signupAttribution`: de dónde llegó al registrarse

Qué: JSON con el primer contacto antes de registrarse (`utm_*`, dominio del sitio que la mandó, página de entrada sin query, `firstSeenAt`). Lo escriben `registerUser(attribution)` y `authenticateUserWithGoogle(attribution)` (solo en altas nuevas) después de limpiarlo con `cleanAttribution` (`utils/analytics/attribution.ts`). Solo lo lee el admin de plataforma y nadie lo escribe por API (`userAccountControlFieldAccess`); si llega dentro de `data` al registrarse, se ignora.

Por qué: Operaciones → Analítica → Adquisición necesita saber qué canal trae empresas que usan y pagan. Del referrer se guarda solo el dominio y de la página solo la ruta: la URL completa puede traer datos de la persona.

Requiere `yarn migrate`. No lo corre el agente.
