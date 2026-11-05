# PetEvent

Eventos de Kadesh Pet: campañas de esterilización, jornadas de vacunación, ferias de adopción, colectas… Cualquier persona con sesión los publica, un admin los revisa en Operaciones (kadesh-business → Kadesh Pet → Eventos) y se muestran en `pet.kadesh.com.mx/eventos`, en la portada y en la app. A la gente de la zona le llega un aviso (campana + push).

| List | Qué es |
| --- | --- |
| `PetEvent` | El evento: qué, dónde (pin + municipio/estado), alcance, costo, cupo, registro y estado de revisión |
| `PetEventSession` | Cada fecha (inicio y fin). Varios días o recurrente = varias fechas |
| `PetEventMultimedia` | Fotos (`s3_events`, `order` 1 = portada, máx. 6) |
| `PetEventInterest` | «Me interesa» / «Asistiré» de una persona (una fila por persona y evento) |

## Ciclo de vida

`pending` → `approved` | `rejected` → (cualquiera) `cancelled`.

- Lo crea alguien que no es admin → `pending` y aviso `event.submitted` a los admins. Un admin lo publica directo.
- `reviewPetEvent` (solo admin) aprueba o rechaza (el rechazo pide motivo, que le llega a quien lo publicó).
- Si quien lo publicó lo edita estando publicado o rechazado, vuelve a `pending`. Si cambió fechas o lugar de uno publicado, `pendingChangeNotice` hace que al aprobarlo se avise `event.updated` a los interesados.
- Subir o cambiar una foto de un evento publicado también lo regresa a `pending` (quitar una no).
- Cancelar (`cancelPetEvent`, dueño o admin): si llegó a publicarse (`approvedAt`) la ficha sigue visible con el aviso y se manda `event.cancelled` a los interesados.

## Reglas

- **Fechas:** de 1 a 30; cada una dura hasta 7 días; ninguna empieza en el pasado (al editar, las que ya tenía sí); todas dentro de 12 meses; al menos una por venir. Se guardan en UTC y se muestran en `timeZone` (la del estado, `utils/geo/mexicoStates.ts`).
- **Ubicación:** pin dentro de México. Municipio y estado salen del formulario o, si faltan, de Nominatim. `stateCode` (clave INEGI) y `cityKey` (municipio sin acentos) sirven para filtros y avisos.
- **Alcance (`scope`):** `zone` (radio `reachKm`: 5/10/20/50), `city`, `state`, `national` (solo admins).
- **Costo:** gratis, o precio en pesos y/o nota («Cuota de recuperación»).
- **Redes:** `facebookUrl`, `instagramUrl`, `tiktokUrl`, `xUrl` aceptan el link o el usuario (`@refugio`) y se guardan como link completo; un link de otro dominio se rechaza. `websiteUrl` es cualquier link http(s). Todas opcionales.
- **Cupo:** con `capacity`, «Asistiré» se cierra al llenarse (`isFull`); «Me interesa» siempre se puede.
- **Límite:** 5 eventos publicados por persona al día (`pet_event_user` en `utils/security/constants.ts`).

## Avisos (`utils/notifications/eventAlerts.ts`)

- `event.nearby`: a quien tiene `eventAlertsEnabled` (por defecto sí) y un centro de alertas (`alertLat/alertLng`), si:
  - su zona toca el área del evento (`distancia ≤ alertRadiusKm + reachKm`; con alcance distinto de `zone`, `reachKm` cuenta 0), o
  - el evento es de su municipio (`city`), su estado (`state`) o nacional.
  Máx. 3 al día por persona, nunca el mismo evento dos veces, nunca a quien lo organiza. Sale al aprobar si la próxima fecha está a 14 días o menos; si no, el cron lo manda al llegar a 14 días (`zoneAlertsSentAt`, `zoneAlertsCount`).
- `event.reminder`: a quien marcó «Me interesa» o «Asistiré», una vez por fecha, cuando faltan 24 h o menos (cron cada hora, `lastRemindedSessionId`).
- `event.approved` / `event.rejected`: a quien lo publicó.
- WhatsApp: todavía no hay plantillas para estos tipos (solo campana y push).

El municipio y estado de la zona de cada persona (`alertCity`, `alertCityKey`, `alertStateCode`) los calcula `models/User/alertRegion.ts` al guardar el centro. Para quienes ya tenían zona, un admin corre `backfillAlertRegions` hasta que `remaining` sea 0.

## Buscadores

- La web tiene una ficha por evento (`/eventos/<slug>`) y páginas por estado y municipio (`/eventos/en/<estado>[/<municipio>]`, con `stateCode` → slug del estado y `cityKey`). Por eso los slugs `nuevo` y `en` están reservados (`RESERVED_SLUGS`).
- Al aprobar, cancelar, rechazar uno publicado o editarlo un admin, `utils/seo/indexNow.ts` avisa a IndexNow (Bing y otros) con la ficha, `/eventos` y las páginas de su estado y municipio. Solo en producción; Google se entera por el sitemap.

## GraphQL

Lectura con las queries de Keystone (`petEvent(where: { slug })`, `petEvents`) más:

- `petEventsFeed(input: { state, city, category, to, lat, lng, radiusKm, sort, past, take, skip })` → próximos (o pasados) con su próxima fecha y distancia.
- `petEventFacets` → estados y municipios con eventos próximos.
- `adminPetEventAlertPreview(id)` → a cuántas personas avisaría y cuándo (solo admin).

Escritura:

- `submitPetEvent(input: PetEventInput!)`, `updateMyPetEvent(id, input)`, `cancelPetEvent(id, reason)`.
- `setPetEventInterest(eventId, kind: "interested" | "going" | null)`.
- `reviewPetEvent(id, approved, note)` (admin), `backfillAlertRegions(limit)` (admin).
- `sendPetEventNotifications(secret)` (cron: `.github/workflows/send-pet-event-notifications.yml`).
- Fotos: `createPetEventMultimedia(data: { image: { upload }, event: { connect: { id } }, order })` y `deletePetEventMultimedia`.

Acceso (`PetEvent.access.ts`): el público ve los publicados y los cancelados que llegaron a publicarse; quien lo publicó ve los suyos en cualquier estado; el admin ve todo. La escritura directa de `PetEvent`, `PetEventSession` y `PetEventInterest` es solo de admins: el resto pasa por las mutaciones.

## Decisiones

### 2026-11-04 — Eventos con revisión y avisos por zona

Qué: lists `PetEvent*` nuevas; avisos reusando la zona de alertas de mascotas (con interruptor propio `eventAlertsEnabled`); municipio y estado de la zona guardados en `User`.

Por qué: la comunidad pide un lugar para anunciar campañas. La revisión evita spam y avisos falsos; reusar la zona evita pedirle a la gente otra configuración.

Qué no hacer: no abrir el CRUD de `PetEvent` a no admins (las reglas de revisión viven en las mutaciones); no avisar a la zona fuera de `sendZoneAlertsIfDue` (es lo que impide avisar dos veces); no permitir alcance nacional a no admins.
