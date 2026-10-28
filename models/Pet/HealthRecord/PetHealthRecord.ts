import { list } from "@keystone-6/core";
import {
  calendarDay,
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { petChildAccess } from "../Pet.access";
import { PET_HEALTH_RECORD_TYPE_OPTIONS } from "../constants";
import { petHealthRecordHooks } from "./PetHealthRecord.hooks";

const adminWriteOnly = {
  create: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
  update: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
};

/**
 * Registro de la cartilla: vacuna, desparasitación, consulta, cirugía, medicamento u otro.
 * Con `nextDueDate` crea o actualiza solo su `PetReminder` (ver PetHealthRecord.hooks.ts).
 */
export default list({
  access: petChildAccess,
  hooks: petHealthRecordHooks,
  ui: {
    listView: {
      initialColumns: ["pet", "type", "name", "appliedDate", "nextDueDate"],
    },
  },
  fields: {
    pet: relationship({
      ref: "Pet.healthRecords",
      many: false,
    }),
    type: select({
      options: PET_HEALTH_RECORD_TYPE_OPTIONS,
      defaultValue: "vaccine",
      validation: { isRequired: true },
    }),
    name: text({
      validation: { isRequired: true },
      ui: { description: "Ej. \"Rabia\", \"Séxtuple\", \"Revisión general\"." },
    }),
    appliedDate: calendarDay({ validation: { isRequired: true } }),
    nextDueDate: calendarDay({
      ui: { description: "Próxima aplicación o revisión. Crea un recordatorio." },
    }),
    veterinary: relationship({
      ref: "PetPlace",
      many: false,
      ui: { description: "Veterinaria donde se aplicó (opcional)." },
    }),
    notes: text({ ui: { displayMode: "textarea" } }),
    attachments: relationship({
      ref: "PetHealthRecordAttachment.healthRecord",
      many: true,
    }),
    verifiedByVet: checkbox({
      defaultValue: false,
      access: adminWriteOnly,
      ui: { description: "Fase 3: la veterinaria confirma el registro. Sin lógica todavía." },
    }),
    createdBy: relationship({
      ref: "User",
      many: false,
      access: adminWriteOnly,
      ui: { itemView: { fieldMode: "read" } },
    }),
    reminder: relationship({
      ref: "PetReminder.healthRecord",
      many: false,
      access: adminWriteOnly,
      ui: { description: "Recordatorio automático de la próxima fecha." },
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
