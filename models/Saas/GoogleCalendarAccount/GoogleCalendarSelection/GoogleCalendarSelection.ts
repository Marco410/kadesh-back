import { list } from "@keystone-6/core";
import { checkbox, relationship, text } from "@keystone-6/core/fields";
import { googleCalendarSelectionAccess } from "./GoogleCalendarSelection.access";

export default list({
  access: googleCalendarSelectionAccess,
  ui: {
    labelField: "calendarName",
    listView: {
      initialColumns: ["calendarName", "account", "isPrimary", "isSelected"],
    },
  },
  fields: {
    account: relationship({
      ref: "GoogleCalendarAccount.calendars",
      many: false,
      ui: { description: "Cuenta de Google a la que pertenece este calendario" },
    }),
    googleCalendarId: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "calendarId en Google (el principal suele ser el correo)" },
    }),
    calendarName: text({
      validation: { isRequired: true },
      ui: { description: "Nombre visible del calendario" },
    }),
    isPrimary: checkbox({ defaultValue: false }),
    isSelected: checkbox({
      defaultValue: false,
      ui: {
        description:
          "Si está marcado, se ve en el calendario unificado y recibe los eventos creados en Kadesh",
      },
    }),
    colorHex: text({ db: { isNullable: true } }),
    // Qué registros del CRM se envían a este calendario (los eventos creados a mano eligen
    // sus calendarios destino uno a uno en `TechCalendarEvent.googleTargets`).
    pushActivities: checkbox({
      defaultValue: true,
      ui: { description: "Enviar actividades de venta nuevas a este calendario" },
    }),
    pushProposals: checkbox({
      defaultValue: true,
      ui: { description: "Enviar propuestas nuevas a este calendario" },
    }),
    pushFollowUps: checkbox({
      defaultValue: true,
      ui: { description: "Enviar tareas de seguimiento nuevas a este calendario" },
    }),
    pushTasks: checkbox({
      defaultValue: true,
      ui: { description: "Enviar tareas nuevas a este calendario" },
    }),
    targetedEvents: relationship({
      ref: "TechCalendarEvent.googleTargets",
      many: true,
      ui: { hideCreate: true, description: "Eventos creados a mano que eligieron este calendario" },
    }),
    eventLinks: relationship({
      ref: "TechCalendarEventGoogleLink.calendarSelection",
      many: true,
      ui: { hideCreate: true, description: "Eventos de Kadesh enviados a este calendario" },
    }),
  },
});
