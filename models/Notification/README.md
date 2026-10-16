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
## WhatsApp

Además de la campana, `notify` manda el aviso por WhatsApp desde el número de Kadesh:
- Solo a quien tiene `User.whatsappNotifications` activo y un `phone` válido (10 dígitos de México, o con lada de otro país).
- Solo si el tipo tiene plantilla en `utils/notifications/whatsapp.ts` (`WHATSAPP_TEMPLATES`). Sin plantilla, solo campana.
- Los valores de la plantilla llegan en `templateValues` (no se guardan). Un valor vacío se manda como "sin especificar", porque Meta rechaza parámetros vacíos.
- Sin `WHATSAPP_PLATFORM_PHONE_NUMBER_ID` / `WHATSAPP_PLATFORM_ACCESS_TOKEN` no se manda nada. Un error de Meta solo queda en el log.

| Tipo | Plantilla (UTILITY, es_MX) | Variables |
| --- | --- | --- |
| `animal.created` | `kadesh_admin_animal_creado` | animal, tipo, quién lo registró |
| `petplace.service_requested` | `kadesh_admin_servicio_solicitado` | servicio, clínica, quién lo pidió |
| `user.bank_details_updated` | `kadesh_admin_datos_bancarios` | nombre del usuario |

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

### 2026-10-14: Avisos también por WhatsApp, una plantilla por tipo

Qué: `notify` manda cada aviso también por WhatsApp desde el número de Kadesh, a quien activó `whatsappNotifications`. Cada tipo tiene su propia plantilla UTILITY.

Por qué: los admins quieren ver los avisos sin abrir el panel. La plantilla genérica (`kadesh_notificacion`) no se mandó a Meta porque la iba a clasificar como Marketing.

Qué no hacer: no usar el WhatsApp BYOK de la empresa para esto. No mandar sin opt-in. No poner en las variables datos sensibles (datos bancarios, ni siquiera los nombres de los campos). Un tipo nuevo necesita su plantilla aprobada en Meta y su entrada en `WHATSAPP_TEMPLATES`; si no, se queda solo en la campana.
