import { list } from "@keystone-6/core";
import { image, integer, relationship, timestamp } from "@keystone-6/core/fields";
import access from "../../../../utils/generalAccess/access";

export default list({
  access,
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
