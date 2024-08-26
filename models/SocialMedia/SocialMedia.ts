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
    veterinary: relationship({
      ref: "Veterinary.veterinary_social_media",
    }),
    pet_shelter: relationship({
      ref: "PetShelter.pet_shelter_social_media",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
