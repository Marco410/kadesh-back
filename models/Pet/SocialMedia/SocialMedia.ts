import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { publicReadAdminWriteAccess } from "../../../utils/access/presets";

export default list({
  access: publicReadAdminWriteAccess,
  fields: {
    social_media: select({
      options: ["Facebook", "Instagram", "X", "LinkedIn", "TikTok"],
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
