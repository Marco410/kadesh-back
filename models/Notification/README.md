# Notification

La campana de Kadesh, para Kadesh Pet y Kadesh Negocios. Hay una fila por destinatario, así que cada persona tiene su propio leído / no leído.

## Cómo se crea

Solo el servidor crea notificaciones, con `notify(context, { audience, product, type, title, … })` de `utils/notifications/notify.ts`:
- Funciona como `logActivity`: usa sudo, nunca lanza y no frena la operación que la dispara.
- `audience: "platform_admins"` crea una fila por cada admin de plataforma. También acepta una lista de ids de usuario.
- Los tipos viven en `constants.ts` (`NOTIFICATION_TYPE`). Un tipo nuevo se agrega ahí y en el front, para su ícono y su enlace.
- En `body` y `metadata` nunca van valores sensibles (contraseñas, tokens, datos bancarios). Solo nombres de campos y referencias.

## Push a la app de Kadesh Pet

Toda notificación con `product: "pet"` también sale como push a los dispositivos de sus destinatarios (`utils/notifications/push.ts`, API HTTP de Expo, sin SDK). No se espera la respuesta de Expo y nunca lanza.
- Tokens en `TokenNotification` (`token`, `platform`, `deviceId`, `lastSeenAt`). La app los guarda con `registerPushToken(token, platform, deviceId)` y los quita al cerrar sesión con `unregisterPushToken(token)`. Por la API generada solo los ven los admins.
- Los tokens que Expo reporta como `DeviceNotRegistered` (en el ticket o en el recibo, ~15 min después) se borran.
- `EXPO_ACCESS_TOKEN` es opcional: solo hace falta si se activa "Enhanced security" en el proyecto de Expo.
- El `data` del push lleva `url` (abre esa pantalla en la app) y `type`.

## Alertas de zona (`animal.nearby`)

`utils/notifications/nearbyAnimalAlerts.ts`. Al guardar el primer registro de un animal **perdido o encontrado** con coordenadas (hook de `AnimalLog`), se avisa a quien tiene `petAlertsEnabled` y su zona (`alertLat`, `alertLng`, `alertRadiusKm`, de 1 a 50 km) incluye el lugar.
- No se avisa al autor ni a cuentas suspendidas o anonimizadas, ni dos veces por el mismo animal.
- Máximo 5 alertas por persona en 24 h (`MAX_NEARBY_ALERTS_PER_DAY`).
- Un reporte con más de 3 días de antigüedad (fecha del avistamiento) no avisa.
- Sin sesión (seed o scripts) no se avisa.
- Los campos de la zona los edita la propia persona con `updateUser` (acceso `userPetAlertsFieldAccess`).

## Acceso

- Cada quien solo ve, marca y borra las suyas (filtro por `recipient`). Nadie las crea por API.
- Por API solo se puede cambiar `readAt`.
- Marcar todas: mutación `markAllNotificationsRead(product)`.
- Lista y contador: con la API generada, `notifications(where: { readAt: null }, orderBy: { createdAt: desc })` y `notificationsCount`.

## Decisiones

### 2026-10-13: Avisos al admin en la campana, no por correo

Qué: estos avisos al admin ahora crean una notificación y ya no mandan correo:
- animal nuevo de un usuario (`animal.created`);
- servicio solicitado por una veterinaria (`petplace.service_requested`);
- datos bancarios actualizados (`user.bank_details_updated`).

El correo solo sale con `ADMIN_NOTIFICATION_EMAILS=on`.

Por qué: cada aviso gastaba el cupo gratuito del proveedor de correo, y en Operaciones ya hay una campana donde verlos.

Qué no hacer: no mandar por aquí los correos a usuarios (bienvenida, citas, novedades); esos siguen igual.
