import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { techGoogleCalendarSyncLogAccess } from "./TechGoogleCalendarSyncLog.access";
import {
  GOOGLE_SYNC_DIRECTION_OPTIONS,
  GOOGLE_SYNC_OPERATION_OPTIONS,
} from "../../../../utils/googleCalendar/constants";

/** Equivalente a TechAiCallLog para las llamadas a la API de Google Calendar. */
export default list({
  access: techGoogleCalendarSyncLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "account",
        "direction",
        "operation",
        "success",
        "durationMs",
      ],
    },
  },
  fields: {
    account: relationship({
      ref: "GoogleCalendarAccount.syncLogs",
      many: false,
    }),
    direction: select({
      type: "string",
      options: [...GOOGLE_SYNC_DIRECTION_OPTIONS],
      validation: { isRequired: true },
      isIndexed: true,
    }),
    operation: select({
      type: "string",
      options: [...GOOGLE_SYNC_OPERATION_OPTIONS],
      validation: { isRequired: true },
      isIndexed: true,
    }),
    success: checkbox({ defaultValue: false }),
    errorMessage: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Error si la llamada falló (sin tokens)" },
    }),
    durationMs: integer({ db: { isNullable: true } }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
