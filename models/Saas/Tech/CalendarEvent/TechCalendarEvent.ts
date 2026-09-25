import { list } from "@keystone-6/core";
import {
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { techCalendarEventAccess } from "./TechCalendarEvent.access";
import { techCalendarEventHooks } from "./TechCalendarEvent.hooks";
import {
  CALENDAR_EVENT_SOURCE_OPTIONS,
  CalendarEventSource,
} from "../../../../utils/googleCalendar/constants";

export default list({
  access: techCalendarEventAccess,
  hooks: techCalendarEventHooks,
  ui: {
    labelField: "title",
    listView: {
      initialColumns: ["title", "startAt", "endAt", "allDay", "sourceType", "createdBy"],
    },
  },
  fields: {
    title: text({ validation: { isRequired: true } }),
    description: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea" },
    }),
    startAt: timestamp({
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        description:
          "Inicio. En eventos de día completo se usa la fecha en UTC (00:00Z)",
      },
    }),
    endAt: timestamp({
      db: { isNullable: true },
      ui: {
        description:
          "Fin (opcional). Sin fin, el evento dura 60 min; en día completo, es el último día incluido",
      },
    }),
    allDay: checkbox({ defaultValue: false }),
    location: text({ db: { isNullable: true } }),
    sourceType: select({
      type: "string",
      options: [...CALENDAR_EVENT_SOURCE_OPTIONS],
      defaultValue: CalendarEventSource.NATIVE,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Creado a mano o generado desde un registro del CRM" },
    }),
    salesActivity: relationship({
      ref: "TechSalesActivity.calendarEvent",
      many: false,
      db: { foreignKey: true },
      ui: { hideCreate: true },
    }),
    followUpTask: relationship({
      ref: "TechFollowUpTask.calendarEvent",
      many: false,
      db: { foreignKey: true },
      ui: { hideCreate: true },
    }),
    task: relationship({
      ref: "TechTask.calendarEvent",
      many: false,
      db: { foreignKey: true },
      ui: { hideCreate: true },
    }),
    proposal: relationship({
      ref: "TechProposal.calendarEvent",
      many: false,
      db: { foreignKey: true },
      ui: { hideCreate: true },
    }),
    createdBy: relationship({
      ref: "User.createdCalendarEvents",
      many: false,
      ui: { description: "Usuario dueño del evento (su cuenta personal recibe el push)" },
    }),
    company: relationship({
      ref: "SaasCompany.calendarEvents",
      many: false,
      ui: { description: "Empresa (su cuenta compartida recibe el push)" },
    }),
    workspace: relationship({
      ref: "SaasWorkspace.calendarEvents",
      many: false,
      ui: { description: "Workspace del CRM, si aplica" },
    }),
    googleTargets: relationship({
      ref: "GoogleCalendarSelection.targetedEvents",
      many: true,
      ui: {
        hideCreate: true,
        description:
          "Calendarios de Google elegidos al crear el evento (solo eventos nativos; los del CRM siguen la configuración de cada calendario)",
      },
    }),
    googleLinks: relationship({
      ref: "TechCalendarEventGoogleLink.event",
      many: true,
      ui: { hideCreate: true, description: "Copias de este evento en Google Calendar" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
