# User

List de cuentas (auth Keystone, roles, company, Stripe, referidos). El registro público de KadeshPet crea un `User` sin sesión.

## Invariantes

- `create` está abierto: cualquiera puede registrarse.
- `query`/`update` exigen sesión y solo ven al propio usuario (admins de company ven compañeros; platform admin ve todo).
- Tras crear un User con email, `userBlogSubscriptionHook` crea o vincula un `BlogSubscription`. Ese side-effect corre con `context.sudo()`: el request de registro no está autenticado y Keystone niega el `connect` a `User` si se usa el context original.
- `my_appointments` (`PetPlaceAppointment.customer`) son las citas que este usuario reservó como cliente; ver [`../PetPlace/PetPlaceAppointment/README.md`](../PetPlace/PetPlaceAppointment/README.md). Distinto de `pet_places`, que son los negocios que reclamó como dueño.

## Decisiones

### 2026-09-14 — BlogSubscription en afterOperation con sudo

Qué: `userBlogSubscriptionHook` usa `context.sudo()` para leer/crear/actualizar `BlogSubscription`.

Por qué: al conectar `BlogSubscription.user`, Keystone exige poder consultar ese `User`. En el registro no hay sesión (`User.query` = deny) y el error era `Access denied: You cannot connect that User`.

Qué no hacer: no volver a usar el `context` del request para este connect; el usuario recién creado no es visible para sí mismo hasta que inicia sesión.
