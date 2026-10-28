import { list } from "@keystone-6/core";
import { image, relationship, timestamp } from "@keystone-6/core/fields";
import {
  petHealthRecordAttachmentAccess,
  validateHealthRecordAttachmentOwner,
} from "../../Pet.access";

/** Foto de la cartilla física o de la receta. Mismo storage de R2 que las fotos de la mascota. */
export default list({
  access: petHealthRecordAttachmentAccess,
  hooks: { validateInput: validateHealthRecordAttachmentOwner },
  fields: {
    image: image({
      storage: "s3_pets",
    }),
    healthRecord: relationship({
      ref: "PetHealthRecord.attachments",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
