import { graphql, list } from "@keystone-6/core";
import {
  calendarDay,
  decimal,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import { ANIMAL_SEX_OPTIONS } from "../../utils/constants/constants";
import { isPlatformAdmin } from "../../utils/access/tenant";
import { petAccess } from "./Pet.access";
import { petHooks } from "./Pet.hooks";
import { PET_STATUS, PET_STATUS_OPTIONS, PET_STERILIZED_OPTIONS } from "./constants";

/** Campos que solo escriben un admin o las mutaciones de la cartilla (con sudo). */
const adminWriteOnly = {
  create: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
  update: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
};

/**
 * Mascota registrada por su familia (cartilla digital). Solo la ven sus dueños (`PetOwner`).
 * Especie y raza usan los mismos catálogos que los reportes (`AnimalType`, `AnimalBreed`) para
 * que `markPetAsLost` las pase tal cual al `Animal`. Ver models/Pet/README.md.
 */
export default list({
  access: petAccess,
  hooks: petHooks,
  ui: {
    listView: {
      initialColumns: ["name", "animal_type", "status", "createdAt"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    birthday: calendarDay({
      ui: { description: "Fecha de nacimiento. Si no se sabe, usa la edad aproximada." },
    }),
    approximateAge: text({
      ui: { description: "Edad aproximada cuando no se sabe la fecha, p. ej. \"2 años\"." },
    }),
    age: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any) {
          if (item?.birthday) {
            const today = new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        },
      }),
    }),
    animal_type: relationship({
      ref: "AnimalType",
      many: false,
      ui: { description: "Especie" },
    }),
    animal_breed: relationship({
      ref: "AnimalBreed",
      many: false,
      ui: { description: "Raza" },
    }),
    sex: select({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "unknown",
    }),
    color: text(),
    distinctiveMarks: text({
      ui: { displayMode: "textarea", description: "Señas particulares: manchas, cicatrices, collar…" },
    }),
    weightKg: decimal({
      precision: 6,
      scale: 2,
      ui: { description: "Peso en kg" },
    }),
    sterilized: select({
      options: PET_STERILIZED_OPTIONS,
      defaultValue: "unknown",
    }),
    microchipNumber: text(),
    multimedia: relationship({
      ref: "PetMultimedia.pet",
      many: true,
    }),
    owners: relationship({
      ref: "PetOwner.pet",
      many: true,
      access: adminWriteOnly,
      ui: { description: "Dueños. El principal se crea solo al registrar la mascota." },
    }),
    healthRecords: relationship({
      ref: "PetHealthRecord.pet",
      many: true,
    }),
    reminders: relationship({
      ref: "PetReminder.pet",
      many: true,
    }),
    status: select({
      options: PET_STATUS_OPTIONS,
      defaultValue: PET_STATUS.ACTIVE,
      validation: { isRequired: true },
      ui: { description: "\"Perdida\" solo se pone y se quita con Marcar como perdida / Ya regresó a casa." },
    }),
    lostReport: relationship({
      ref: "Animal",
      many: false,
      access: adminWriteOnly,
      ui: { description: "Reporte de perdida abierto. Lo llenan markPetAsLost y markPetAsFound." },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
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
