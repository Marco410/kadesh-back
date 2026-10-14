import { list } from "@keystone-6/core";
import { image, integer, relationship, timestamp } from "@keystone-6/core/fields";
import { animalChildAccess, validateAnimalChildOwner } from "../Animal.access";
import { animalMultimediaFacebookHook } from "../Animal.hooks";

export default list({
  access: animalChildAccess,
  hooks: { ...animalMultimediaFacebookHook, validateInput: validateAnimalChildOwner },
  fields: {
    image: image({
      storage: "s3_animals",
    }),
    animal: relationship({
      ref: "Animal.multimedia",
    }),
    order: integer({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: {
        description: "1 es la portada de la ficha. 2, 3… el resto.",
      },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
