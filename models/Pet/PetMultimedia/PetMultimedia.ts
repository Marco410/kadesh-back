import { list } from "@keystone-6/core";
import { image, integer, relationship, timestamp } from "@keystone-6/core/fields";
import { petChildAccess, validatePetChildOwner } from "../Pet.access";

export default list({
  access: petChildAccess,
  hooks: { validateInput: validatePetChildOwner },
  fields: {
    image: image({
      storage: "s3_pets",
    }),
    pet: relationship({
      ref: "Pet.multimedia",
    }),
    order: integer({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: {
        description: "1 es la foto principal. 2, 3… el resto.",
      },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
