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

`utils/notifications/animalReportAlerts.ts` y `utils/notifications/possibleMatchAlerts.ts`. Van a quien atiende el reporte (`Animal.user`). Si lo subió la cuenta de automatización (`PET_AUTOMATION_USER_ID`) o no tiene autor, van a los admins. El link abre la ficha (`#comentarios` en comentarios, `?reclamo=<id>` en solicitudes). Comentarios, coincidencias y solicitudes también salen por WhatsApp a quien lo activó (ver "WhatsApp"); `animal.duplicate_reported` y `animal.merged` no tienen plantilla: solo campana y push.

| Tipo | Cuándo | A quién |
| --- | --- | --- |
| `animal.commented` | comentario normal (`AnimalComment.kind: comment`) | quien atiende el reporte, salvo que sea el autor del comentario; no va a admins |
| `animal.duplicate_reported` | quien iba a publicar el mismo animal comentó en vez de duplicar (`duplicate_report`) | quien atiende el reporte |
| `animal.possible_match` | comentario `possible_match`, o un reporte nuevo del otro lado (perdido ↔ encontrado) con parecido `likely`; una vez por reporte y destinatario | quien atiende el reporte parecido |
| `animal.claim_requested` | alguien pide quedarse con el reporte (`AnimalClaim`) | quien atiende el reporte |
| `animal.claim_approved` / `animal.claim_rejected` | se respondió la solicitud, o se rechazó por aprobar otra o por unir el reporte | quien la pidió |
| `animal.merged` | un admin unió un reporte repetido con el principal (`Animal.duplicateOf`) | quien hizo el repetido |

## Recordatorios de la cartilla (`pet.reminder_due`)

Los manda el cron diario `sendDuePetReminders` a los dueños de la mascota cuando el recordatorio tiene el canal `push` (campana + push y, por `notify`, WhatsApp a quien lo activó, con `kadesh_pet_recordatorio`). Si el recordatorio solo trae el canal `whatsapp`, se manda directo a los dueños con el opt-in; con los dos canales no llega doble. Detalle en `docs/cartilla/README.md`.

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
| `animal.nearby` | `kadesh_pet_animal_cerca` | estado (perdido/encontrado), animal y lugar, enlace |
| `animal.possible_match` | `kadesh_pet_coincidencia` | resumen, enlace |
| `animal.claim_requested` | `kadesh_pet_reclamo_solicitado` | quién lo pide, animal, enlace |
| `animal.claim_approved` | `kadesh_pet_reclamo_aceptado` | animal, enlace |
| `animal.claim_rejected` | `kadesh_pet_reclamo_rechazado` | animal, motivo, enlace |
| `animal.commented` | `kadesh_pet_comentario` | quién comentó, animal, comentario, enlace |
| `pet.reminder_due` | `kadesh_pet_recordatorio` | mascota, recordatorio, cuándo vence, enlace a la cartilla |

Los usuarios de Pet lo activan en la web, en `/notificaciones` ("Avisos por WhatsApp"), que guarda `whatsappNotifications` con `updateUser` (solo su propio usuario) y exige `phone`. En los tipos de Pet, que nadie tenga el opt-in es lo normal: no deja línea en el log (en los de admin sí).

**Por tipo**: `User.whatsappMutedTypes` (JSON, lista de `NOTIFICATION_TYPE`) guarda los tipos que la persona apagó; con el interruptor general activo le llega todo lo demás.
- Se guarda lo apagado y no lo encendido, para que un tipo nuevo con plantilla llegue sin pedir nada.
- Lo edita la propia persona (acceso `userPetAlertsFieldAccess`) y se valida contra los tipos conocidos (`models/User/whatsappPrefs.ts`).
- `sendNotificationWhatsappToOptedIn` y el canal `whatsapp` de los recordatorios saltan a quien lo silenció, sin dejar línea en el log.
- La web agrupa las respuestas a una solicitud (`animal.claim_approved` y `animal.claim_rejected`) en un solo interruptor.
- **Campo nuevo: falta la migración** (`yarn migrate`, la corre una persona).

### Plantillas de Kadesh Pet (texto para darlas de alta en Meta)

Categoría **Utility**, idioma **Spanish (MEX)** (`es_MX`), solo cuerpo (sin encabezado ni botones: `sendWhatsAppTemplateMessage` solo manda variables del cuerpo). Ninguna empieza ni termina con una variable y no hay dos variables juntas, porque Meta las rechaza. Cada una cierra con cómo apagarlas. Hasta que Meta apruebe una plantilla, ese tipo falla al mandar y queda en el log (`Graph API error`); la campana y el push no se afectan.

**`kadesh_pet_animal_cerca`**
```
Alerta de tu zona en Kadesh Pet: reportaron un animal {{1}} cerca de ti. Es {{2}}. Míralo y ayuda a que vuelva a casa: {{3}}

Recibes este aviso porque activaste las alertas de zona y los avisos por WhatsApp. Puedes apagarlos en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `perdido` · `Firulais (perro) en Centro` · `https://pet.kadesh.com.mx/animales/firulais-centro`

**`kadesh_pet_coincidencia`**
```
Kadesh Pet encontró una posible coincidencia con uno de tus reportes. {{1}}. Revisa las fotos y, si es el mismo, contacta a quien lo reportó: {{2}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Reportaron uno encontrado parecido a Firulais, cerca de donde se perdió` · `https://pet.kadesh.com.mx/animales/perro-encontrado-centro`

**`kadesh_pet_reclamo_solicitado`**
```
Kadesh Pet: {{1}} dice que el animal de tu reporte ({{2}}) es su mascota. Revisa su mensaje y decide si el reporte pasa a su nombre: {{3}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Ana` · `Firulais` · `https://pet.kadesh.com.mx/animales/firulais-centro?reclamo=abc123`

**`kadesh_pet_reclamo_aceptado`**
```
Kadesh Pet: aceptaron tu solicitud y ahora el reporte de {{1}} está a tu nombre. Revisa que el teléfono y los datos de contacto sean los tuyos: {{2}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Firulais` · `https://pet.kadesh.com.mx/animales/firulais-centro`

**`kadesh_pet_reclamo_rechazado`**
```
Kadesh Pet: no se aceptó tu solicitud para el reporte de {{1}}. Motivo: {{2}}. Puedes dejar un comentario en la ficha: {{3}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Firulais` · `Quien lo reportó no la aceptó` · `https://pet.kadesh.com.mx/animales/firulais-centro`

**`kadesh_pet_comentario`**
```
Kadesh Pet: {{1}} comentó en tu reporte de {{2}}: «{{3}}». Respóndele en la ficha: {{4}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Ana` · `Firulais` · `Lo vi ayer cerca del mercado` · `https://pet.kadesh.com.mx/animales/firulais-centro#comentarios`

**`kadesh_pet_recordatorio`**
```
Recordatorio de Kadesh Pet: {{1}} tiene pendiente «{{2}}», que {{3}}. Revisa su cartilla: {{4}}

Puedes apagar los avisos por WhatsApp en pet.kadesh.com.mx/notificaciones
```
Ejemplos: `Luna` · `Vacuna antirrábica` · `vence mañana` · `https://pet.kadesh.com.mx/perfil?tab=pets&pet=abc123`

Si Meta cambia el texto al aprobar (o lo rechaza), el número y el orden de las variables deben seguir igual que en `WHATSAPP_TEMPLATES[tipo].params`; si cambian, hay que ajustar los dos.

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

### 2026-11-03: Avisos de Kadesh Pet por WhatsApp, con opt-in desde la web

Qué: siete plantillas `kadesh_pet_*` (animal cerca, posible coincidencia, solicitud de reporte pedida, aceptada y rechazada, comentario y recordatorio). Cada aviso las llena con `templateValues`. La persona las activa en `/notificaciones` de kadesh-landing, que guarda `whatsappNotifications`.

Por qué: quien perdió a su mascota no siempre abre la app; el WhatsApp llega aunque no tenga notificaciones push.

Qué no hacer:
- No mandar sin el opt-in de la persona.
- No unir las siete plantillas en una genérica: Meta la clasificaría como Marketing.
- No poner el enlace al final del cuerpo: Meta rechaza una plantilla que empieza o termina con una variable.
- No mandar el recordatorio por WhatsApp dos veces cuando el recordatorio trae `push` y `whatsapp`.
