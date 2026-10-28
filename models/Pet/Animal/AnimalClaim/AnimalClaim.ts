import { list } from "@keystone-6/core";
import { image, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminWriteOnly, animalClaimAccess } from "./AnimalClaim.access";
import {
  animalClaimAfterOperation,
  resolveAnimalClaimInput,
  validateAnimalClaimInput,
} from "./AnimalClaim.hooks";
import { ANIMAL_CLAIM_STATUS, ANIMAL_CLAIM_STATUS_OPTIONS } from "./constants";

/**
 * Alguien dice que el animal de un reporte es su mascota. Lo decide quien reportó (o un admin si
 * lo subió la automatización) con `resolveAnimalClaim`; al aprobar, el reporte pasa a su nombre.
 */
export default list({
  access: animalClaimAccess,
  hooks: {
    resolveInput: resolveAnimalClaimInput,
    validateInput: validateAnimalClaimInput,
    afterOperation: animalClaimAfterOperation,
  },
  ui: {
    listView: {
      initialColumns: ["animal", "claimant", "status", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    animal: relationship({
      ref: "Animal",
      many: false,
    }),
    claimant: relationship({
      ref: "User",
      many: false,
      ui: { description: "Quien dice que es su mascota." },
    }),
    /** Nombre de quien reclama: quien atiende el reporte no puede leer su `User`. */
    claimantName: text({
      access: adminWriteOnly,
      ui: { itemView: { fieldMode: "read" } },
    }),
    previousUser: relationship({
      ref: "User",
      many: false,
      access: adminWriteOnly,
      ui: { description: "Quien atendía el reporte cuando llegó la solicitud." },
    }),
    message: text({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" },
    }),
    phone: text({
      ui: { description: "Teléfono de quien reclama. Pasa al reporte si se aprueba." },
    }),
    evidence: image({
      storage: "s3_animals",
    }),
    status: select({
      options: ANIMAL_CLAIM_STATUS_OPTIONS,
      defaultValue: ANIMAL_CLAIM_STATUS.PENDING,
      validation: { isRequired: true },
      access: adminWriteOnly,
    }),
    rejectReason: text({
      access: adminWriteOnly,
    }),
    resolvedBy: relationship({
      ref: "User",
      many: false,
      access: adminWriteOnly,
    }),
    resolvedAt: timestamp({
      db: { isNullable: true },
      access: adminWriteOnly,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
