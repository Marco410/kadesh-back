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
## Avisos de un reporte (comentarios, coincidencias, solicitudes y reportes unidos)

`utils/notifications/animalReportAlerts.ts` y `utils/notifications/possibleMatchAlerts.ts`. Van a quien atiende el reporte (`Animal.user`). Si lo subió la cuenta de automatización (`PET_AUTOMATION_USER_ID`) o no tiene autor, van a los admins. El link abre la ficha (`#comentarios` en comentarios, `?reclamo=<id>` en solicitudes). Ningún tipo tiene plantilla de WhatsApp: solo campana y push.

| Tipo | Cuándo | A quién |
| --- | --- | --- |
| `animal.commented` | comentario normal (`AnimalComment.kind: comment`) | quien atiende el reporte, salvo que sea el autor del comentario; no va a admins |
| `animal.duplicate_reported` | quien iba a publicar el mismo animal comentó en vez de duplicar (`duplicate_report`) | quien atiende el reporte |
| `animal.possible_match` | comentario `possible_match`, o un reporte nuevo del otro lado (perdido ↔ encontrado) con parecido `likely`; una vez por reporte y destinatario | quien atiende el reporte parecido |
| `animal.claim_requested` | alguien pide quedarse con el reporte (`AnimalClaim`) | quien atiende el reporte |
| `animal.claim_approved` / `animal.claim_rejected` | se respondió la solicitud, o se rechazó por aprobar otra o por unir el reporte | quien la pidió |
| `animal.merged` | un admin unió un reporte repetido con el principal (`Animal.duplicateOf`) | quien hizo el repetido |

## Recordatorios de la cartilla (`pet.reminder_due`)

Los manda el cron diario `sendDuePetReminders` a los dueños de la mascota cuando el recordatorio tiene el canal `push` (campana + push). No tiene plantilla de WhatsApp todavía, así que `notify` no lo manda por WhatsApp. Detalle en `docs/cartilla/README.md`.

## WhatsApp

Además de la campana, `notify` manda el aviso por WhatsApp desde el número de Kadesh:
- Solo a quien tiene `User.whatsappNotifications` activo y un `phone` válido (10 dígitos de México, o con lada de otro país).
- Los admins lo tienen activo por defecto: al crear un usuario con rol `admin`, o al darle ese rol, queda en `true` (`adminWhatsappDefaultHook` en `models/User/User.hooks.ts`). Se puede apagar desde su usuario en el Admin UI. Para los admins que ya existían: `pnpm whatsapp:admins-on --apply` (o `whatsapp:admins-on:prod`). El resto de los usuarios sigue apagado hasta que acepte.
- Solo si el tipo tiene plantilla en `utils/notifications/whatsapp.ts` (`WHATSAPP_TEMPLATES`). Sin plantilla, solo campana.
- Los valores de la plantilla llegan en `templateValues` (no se guardan). Un valor vacío se manda como "sin especificar", porque Meta rechaza parámetros vacíos.
- Sin `WHATSAPP_PLATFORM_PHONE_NUMBER_ID` / `WHATSAPP_PLATFORM_ACCESS_TOKEN` no se manda nada. Cada aviso que no sale deja una línea en el log que dice por qué (ver abajo).

| Tipo | Plantilla (UTILITY, es_MX) | Variables |
| --- | --- | --- |
| `animal.created` | `kadesh_admin_animal_creado` | animal, tipo, quién lo registró |
| `petplace.service_requested` | `kadesh_admin_servicio_solicitado` | servicio, clínica, quién lo pidió |
| `user.bank_details_updated` | `kadesh_admin_datos_bancarios` | nombre del usuario |

### Si no llega el WhatsApp

El número de estos avisos sale de las variables `WHATSAPP_PLATFORM_*`. No es el WhatsApp que se conecta en el CRM: ese guarda sus credenciales en `SaasCompany`, y lo usan "Mandar mensaje de inicio" y el chat. Que el CRM sí mande no prueba nada de estos avisos. El chat del CRM tampoco muestra estos avisos: solo guarda lo que se manda desde ahí.

Busca `[notify:whatsapp]` en los logs:

| Línea | Qué pasa |
| --- | --- |
| `Avisos por WhatsApp APAGADOS: falta …` (al arrancar) | Faltan las variables en el entorno. |
| `… no salió por WhatsApp: falta …` | Lo mismo, al momento del aviso. |
| `… ninguno de los N destinatario(s) tiene activos los avisos de WhatsApp` | Ningún admin tiene `whatsappNotifications`. |
| `… tienen activos los avisos, pero sin teléfono` | El admin no tiene `User.phone`. |
| `… no tiene un teléfono válido` | El `phone` no se puede convertir a número de WhatsApp. |
| `… a usuario … : [whatsapp] Graph API error …` | Meta rechazó el envío: plantilla no aprobada, idioma o número de variables. |
| `… aceptado por Meta para usuario … : wamid…` | Meta lo aceptó. Si no llega, busca ese `wamid` en `[whatsapp webhook] Meta no entregó …`, que trae el código de error de Meta. |

Para que aparezca el `Meta no entregó …`, el WABA del número de plataforma tiene que estar conectado a una empresa con su App Secret; si no, el webhook lo descarta y lo dice en el log.

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

### 2026-11-03: WhatsApp activo por defecto para admins

Qué: al crear un admin o darle el rol, `whatsappNotifications` queda activo. El script `scripts/enableAdminWhatsappNotifications.ts` activa a los admins que ya existían.

Por qué: el aviso no llegaba porque el admin nunca lo había activado, y el campo solo se cambia desde el Admin UI.

Qué no hacer: no activarlo por defecto para todos los usuarios. Meta pide que cada persona acepte recibir WhatsApp del negocio; para usuarios hace falta que lo acepten en la web o la app.
