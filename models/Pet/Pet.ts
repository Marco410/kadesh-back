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
import type { KeystoneContext } from "@keystone-6/core/types";
import { ANIMAL_SEX_OPTIONS } from "../../utils/constants/constants";
import { getSessionUserId, isPlatformAdmin } from "../../utils/access/tenant";
import { findPetAccessRole, petAccess } from "./Pet.access";
import { petHooks } from "./Pet.hooks";
import { PET_RESCUE_STAGE_OPTIONS, PET_STATUS, PET_STATUS_OPTIONS, PET_STERILIZED_OPTIONS } from "./constants";

/** Campos que solo escriben un admin o las mutaciones de la cartilla (con sudo). */
const adminWriteOnly = {
  create: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
  update: ({ session }: { session?: unknown }) => isPlatformAdmin(session as any),
};

/**
 * Mascota registrada por su familia (cartilla digital). Solo la ven sus dueños (`PetOwner`), o el
 * equipo del espacio de rescate si es una ficha interna (`organization`, ver Pet.access.ts).
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
    /**
     * Ficha interna de un espacio de rescate: sin dueños hasta que se adopta. Se elige al crearla
     * (si eres del equipo, ver Pet.hooks.ts); cambiarla después solo lo hacen un admin y las
     * mutaciones de rescate (`completeRescueAdoption` la quita).
     */
    organization: relationship({
      ref: "RescueOrganization.pets",
      many: false,
      access: { update: adminWriteOnly.update },
      ui: { description: "Espacio de rescate que tiene al animal (ficha interna)" },
    }),
    stage: select({
      options: PET_RESCUE_STAGE_OPTIONS,
      db: { isNullable: true },
      ui: { description: "Etapa en el espacio de rescate (solo fichas de un espacio)" },
    }),
    intakeDate: calendarDay({ ui: { description: "Llegó al espacio de rescate" } }),
    /** Persona del equipo que lo tiene en su hogar temporal: ella ve y edita solo estas fichas. */
    fosterMember: relationship({
      ref: "RescueOrganizationMember",
      many: false,
      ui: { description: "Hogar temporal asignado (alguien del equipo del espacio)" },
    }),
    /** Reporte público del animal: del que se creó la ficha o el que se publicó desde ella. */
    publicReport: relationship({
      ref: "Animal",
      many: false,
      access: adminWriteOnly,
      ui: { description: "Reporte público ligado (convertAnimalToPet / publishRescuePet)" },
    }),
    adoptedFromOrganization: relationship({
      ref: "RescueOrganization",
      many: false,
      access: adminWriteOnly,
      ui: { description: "Espacio de rescate del que se adoptó (lo llena completeRescueAdoption)" },
    }),
    adoptedAt: timestamp({
      access: adminWriteOnly,
      ui: { itemView: { fieldMode: "read" } },
    }),
    /**
     * Con qué rol entra quien consulta: `principal` / `family` (dueños) o su rol en el equipo del
     * espacio. El front decide con esto qué botones mostrar; los permisos los aplica el acceso.
     */
    viewerRole: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context: KeystoneContext) {
          const userId = getSessionUserId(context.session);
          if (!userId || !item?.id) return null;
          return findPetAccessRole(
            context,
            { id: item.id, organizationId: item.organizationId, fosterMemberId: item.fosterMemberId },
            userId,
          );
        },
      }),
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
