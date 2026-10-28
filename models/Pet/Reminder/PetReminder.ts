import { list } from "@keystone-6/core";
import {
  calendarDay,
  integer,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { petChildAccess } from "../Pet.access";
import {
  PET_REMINDER_CHANNEL_OPTIONS,
  PET_REMINDER_DEFAULT_CHANNELS,
  PET_REMINDER_DEFAULT_DAYS_BEFORE,
  PET_REMINDER_MAX_DAYS_BEFORE,
  PET_REMINDER_STATUS,
  PET_REMINDER_STATUS_OPTIONS,
} from "../constants";
import { petReminderHooks } from "./PetReminder.hooks";

/**
 * Recordatorio de la cartilla. Sale `notifyDaysBefore` días antes de `dueDate` por los canales
 * elegidos; lo manda el cron diario `sendDuePetReminders` (.github/workflows/send-pet-reminders.yml).
 */
export default list({
  access: petChildAccess,
  hooks: petReminderHooks,
  ui: {
    listView: {
      initialColumns: ["pet", "title", "dueDate", "status"],
    },
  },
  fields: {
    pet: relationship({
      ref: "Pet.reminders",
      many: false,
    }),
    healthRecord: relationship({
      ref: "PetHealthRecord.reminder",
      many: false,
      db: { foreignKey: true },
      ui: { description: "Registro que lo generó (se crea solo con su próxima fecha)." },
    }),
    title: text({ validation: { isRequired: true } }),
    dueDate: calendarDay({ validation: { isRequired: true } }),
    notifyDaysBefore: integer({
      defaultValue: PET_REMINDER_DEFAULT_DAYS_BEFORE,
      validation: { isRequired: true, min: 0, max: PET_REMINDER_MAX_DAYS_BEFORE },
      ui: { description: "Cuántos días antes de la fecha se avisa." },
    }),
    channels: multiselect({
      type: "string",
      options: PET_REMINDER_CHANNEL_OPTIONS,
      defaultValue: PET_REMINDER_DEFAULT_CHANNELS,
    }),
    status: select({
      options: PET_REMINDER_STATUS_OPTIONS,
      defaultValue: PET_REMINDER_STATUS.PENDING,
      validation: { isRequired: true },
    }),
    sentAt: timestamp({
      db: { isNullable: true },
      access: {
        create: ({ session }) => isPlatformAdmin(session as any),
        update: ({ session }) => isPlatformAdmin(session as any),
      },
      ui: { itemView: { fieldMode: "read" } },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      defaultValue: { kind: "now" },
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
