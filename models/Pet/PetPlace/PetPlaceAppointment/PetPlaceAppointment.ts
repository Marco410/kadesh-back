import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { petPlaceAppointmentAccess } from "./PetPlaceAppointment.access";
import {
  petPlaceAppointmentValidateInput,
  petPlaceAppointmentEmailHook,
} from "./PetPlaceAppointment.hooks";
import {
  PET_PLACE_APPOINTMENT_STATUS,
  PET_PLACE_APPOINTMENT_STATUS_OPTIONS,
} from "./status";

export default list({
  access: petPlaceAppointmentAccess,
  ui: {
    listView: {
      initialColumns: [
        "pet_place",
        "customer",
        "startsAt",
        "endsAt",
        "status",
        "petName",
      ],
    },
  },
  hooks: {
    validateInput: petPlaceAppointmentValidateInput,
    afterOperation: petPlaceAppointmentEmailHook.afterOperation,
  },
  fields: {
    pet_place: relationship({
      ref: "PetPlace.pet_place_appointments",
      many: false,
      ui: { description: "Negocio (veterinaria, refugio, hotel, etc.)" },
    }),
    customer: relationship({
      ref: "User.my_appointments",
      many: false,
      ui: { description: "Usuario que reservó la cita" },
    }),
    service: relationship({
      ref: "PetPlaceService",
      many: false,
      ui: { description: "Servicio del catálogo (opcional)" },
    }),
    startsAt: timestamp({
      validation: { isRequired: true },
      ui: { description: "Inicio de la cita / check-in" },
    }),
    endsAt: timestamp({
      validation: { isRequired: true },
      ui: { description: "Fin de la cita / check-out" },
    }),
    status: select({
      type: "string",
      options: PET_PLACE_APPOINTMENT_STATUS_OPTIONS,
      defaultValue: PET_PLACE_APPOINTMENT_STATUS.PENDING,
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    petName: text({
      ui: { description: "Nombre de la mascota" },
    }),
    petSpecies: text({
      ui: { description: "Especie/raza (texto libre, ej. Perro - Labrador)" },
    }),
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Notas del cliente (motivo de la visita, indicaciones)",
      },
    }),
    ownerNotes: text({
      ui: {
        displayMode: "textarea",
        description: "Notas internas del negocio (no visibles para el cliente)",
      },
    }),
    cancelReason: text({
      db: { isNullable: true },
      ui: { description: "Motivo de cancelación" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
