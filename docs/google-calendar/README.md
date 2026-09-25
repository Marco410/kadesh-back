# Google Calendar (feature de plan `calendar_crm`)

Calendario propio de Kadesh (`TechCalendarEvent`) sincronizado con Google Calendar. Cada usuario puede
conectar su cuenta (personal) y el `admin_company` una cuenta compartida por toda la `SaasCompany`.

## Modelo

| Lista | Rol |
| --- | --- |
| `GoogleCalendarAccount` | Cuenta de Google conectada. `scopeType`: `personal` (`user`) o `company` (`company`). Tokens cifrados (AES-256-GCM con `AI_ENCRYPTION_KEY`), nunca se leen por GraphQL. |
| `GoogleCalendarSelection` | Un calendario de esa cuenta. `isSelected` = se ve en el calendario unificado **y** recibe los eventos de Kadesh. |
| `TechCalendarEvent` | Evento nativo. `sourceType`: `native`, `sales_activity`, `follow_up_task`, `task`, `proposal`. |
| `TechCalendarEventGoogleLink` | Mapa evento ↔ evento en un calendario de Google (para actualizar/borrar sin duplicar). |
| `TechGoogleCalendarSyncLog` | Log de cada llamada a Google (equivalente a `TechAiCallLog`). |

## Flujo OAuth (sin rutas Express)

1. Front → `getGoogleCalendarAuthUrl(scopeType, companyId?)` → `{ url }` (incluye `state` firmado, 15 min).
2. Usuario consiente en Google; Google redirige al front (`GOOGLE_CALENDAR_REDIRECT_URI`) con `?code&state`.
3. Front → `connectGoogleCalendarAccount(code, state)`: valida el `state` contra la sesión, intercambia el código,
   guarda tokens cifrados y crea una `GoogleCalendarSelection` por calendario (todas con `isSelected: false`).
4. Front → `toggleGoogleCalendarSelection(selectionId, isSelected)` para elegir calendarios.

Otras operaciones: `refreshGoogleCalendarList`, `disconnectGoogleCalendarAccount` (revoca el token en Google),
y la query `syncGoogleCalendarNow(selectionIds, timeMin, timeMax)` que trae eventos en vivo de Google
(no los guarda; devuelve `kadeshEventId` para deduplicar los que Kadesh mismo empujó).

Las cuentas/calendarios se **leen** con las queries generadas por Keystone (`googleCalendarAccounts`,
`googleCalendarSelections`); todo lo que escribe pasa por las mutaciones de arriba.

## Sincronización

- **Push automático** (Kadesh → Google): `TechCalendarEvent.hooks.ts` empuja en create/update y borra en delete.
  Destinos = calendarios `isSelected` de la cuenta personal del dueño del evento y de la cuenta compartida de la empresa, filtrados así:
  - evento **nativo**: solo los elegidos al crearlo (`TechCalendarEvent.googleTargets`); sin ninguno no se envía;
  - evento del **CRM**: los calendarios con activado el flag de ese tipo (`GoogleCalendarSelection.pushActivities / pushProposals / pushFollowUps / pushTasks`, todos `true` por defecto). Se edita con `setGoogleCalendarPushSettings`.
- **CRM → evento**: solo registros **nuevos** de `TechSalesActivity`, `TechFollowUpTask`, `TechTask` y `TechProposal`
  generan su `TechCalendarEvent` (`utils/googleCalendar/crmEvents.ts`); editarlos/borrarlos actualiza/borra el evento.
  Los registros anteriores no se tocan.
- **Pull**: bajo demanda (`syncGoogleCalendarNow`). No hay webhooks (`watch`) en esta fase.

## Permisos

- Conectar/administrar cuenta **personal**: su dueño. Cuenta **compartida**: `admin_company` de la empresa. `ADMIN` siempre.
- Ver eventos de una cuenta compartida: cualquier miembro de la empresa.
- `TechCalendarEvent`: `admin_company` ve los de la empresa; vendedor/user_company solo los suyos.
- Todo gateado por `calendar_crm` en la suscripción activa (`utils/googleCalendar/planFeature.ts`).

## Configuración

Variables globales por ambiente (una sola app de Kadesh en Google Cloud): `GOOGLE_CALENDAR_CLIENT_ID`,
`GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` (ver `config/.env.template`).
En Google Cloud: habilitar Calendar API, crear OAuth client tipo Web y registrar el redirect URI.
El scope `calendar` es sensible: en producción requiere verificación de Google; en modo *Testing* solo
funcionan los test users.
