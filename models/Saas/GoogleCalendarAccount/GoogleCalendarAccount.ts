import { list } from "@keystone-6/core";
import {
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { googleCalendarAccountAccess } from "./GoogleCalendarAccount.access";
import { googleCalendarAccountHooks } from "./GoogleCalendarAccount.hooks";
import {
  GOOGLE_CALENDAR_SCOPE_TYPE_OPTIONS,
  GoogleCalendarScopeType,
} from "../../../utils/googleCalendar/constants";

/** Tokens: solo accesibles vía context.sudo() desde código de servidor (igual que aiApiKeyEncrypted). */
const hiddenTokenAccess = {
  read: () => false,
  create: () => false,
  update: () => false,
};

export default list({
  access: googleCalendarAccountAccess,
  hooks: googleCalendarAccountHooks,
  ui: {
    labelField: "googleAccountEmail",
    listView: {
      initialColumns: [
        "googleAccountEmail",
        "scopeType",
        "user",
        "company",
        "isActive",
        "lastSyncedAt",
      ],
    },
  },
  fields: {
    scopeType: select({
      type: "string",
      options: [...GOOGLE_CALENDAR_SCOPE_TYPE_OPTIONS],
      defaultValue: GoogleCalendarScopeType.PERSONAL,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Personal (de un usuario) o compartida por toda la empresa" },
    }),
    user: relationship({
      ref: "User.googleCalendarAccounts",
      many: false,
      ui: { description: "Dueño de la cuenta (solo si es personal)" },
    }),
    company: relationship({
      ref: "SaasCompany.googleCalendarAccounts",
      many: false,
      ui: { description: "Empresa dueña de la cuenta (solo si es compartida)" },
    }),
    connectedByUser: relationship({
      ref: "User.connectedGoogleCalendarAccounts",
      many: false,
      ui: { description: "Quién autorizó la conexión en Google (auditoría)" },
    }),
    googleAccountEmail: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Correo de la cuenta de Google conectada" },
    }),
    accessTokenEncrypted: text({
      db: { isNullable: true },
      access: hiddenTokenAccess,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Solo mutaciones custom vía sudo",
      },
    }),
    refreshTokenEncrypted: text({
      db: { isNullable: true },
      access: hiddenTokenAccess,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Solo mutaciones custom vía sudo",
      },
    }),
    tokenExpiresAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Cuándo expira el access token actual" },
    }),
    scope: text({
      db: { isNullable: true },
      ui: { description: "Scopes de Google otorgados" },
    }),
    isActive: checkbox({
      defaultValue: true,
      ui: {
        description:
          "false si Google revocó el acceso: el usuario debe reconectar la cuenta",
      },
    }),
    lastSyncedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Última lectura exitosa desde Google" },
    }),
    lastSyncError: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Último error al hablar con Google" },
    }),
    calendars: relationship({
      ref: "GoogleCalendarSelection.account",
      many: true,
      ui: { hideCreate: true, description: "Calendarios de esta cuenta" },
    }),
    syncLogs: relationship({
      ref: "TechGoogleCalendarSyncLog.account",
      many: true,
      ui: { hideCreate: true, description: "Historial de llamadas a Google" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
