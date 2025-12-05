import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    social_media: select({
      options: ["Facebook", "Instagram", "X", "LinkedIn"],
      validation: { isRequired: true },
    }),
    link: text({
      validation: { isRequired: true },
    }),
    pet_place: relationship({
      ref: "PetPlace.pet_place_social_media",
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
  },
});
