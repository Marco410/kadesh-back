import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { techCalendarEventGoogleLinkAccess } from "./TechCalendarEventGoogleLink.access";
import {
  GOOGLE_LINK_STATUS_OPTIONS,
  GoogleLinkStatus,
} from "../../../../../utils/googleCalendar/constants";

/** Mapa evento de Kadesh ↔ evento en un calendario de Google (para actualizar/borrar sin duplicar). */
export default list({
  access: techCalendarEventGoogleLinkAccess,
  ui: {
    listView: {
      initialColumns: [
        "event",
        "calendarSelection",
        "lastPushStatus",
        "lastPushedAt",
      ],
    },
  },
  fields: {
    event: relationship({
      ref: "TechCalendarEvent.googleLinks",
      many: false,
    }),
    calendarSelection: relationship({
      ref: "GoogleCalendarSelection.eventLinks",
      many: false,
    }),
    googleEventId: text({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "id del evento en Google (se llena tras el push exitoso)" },
    }),
    lastPushedAt: timestamp({ db: { isNullable: true } }),
    lastPushStatus: select({
      type: "string",
      options: [...GOOGLE_LINK_STATUS_OPTIONS],
      defaultValue: GoogleLinkStatus.PENDING,
    }),
    lastPushError: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea" },
    }),
  },
});
