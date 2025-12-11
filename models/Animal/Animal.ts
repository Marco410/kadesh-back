import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { ANIMAL_SEX_OPTIONS } from "../../utils/constants/constants";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    sex: select({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "male",
    }),
    animal_type: relationship({
      ref: "AnimalType",
      many: false,
    }),
    animal_breed: relationship({
      ref: "AnimalBreed",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    multimedia: relationship({
      ref: "AnimalMultimedia.animal",
      many: true,
    }),
    logs: relationship({
      ref: "AnimalLog.animal",
      many: true,
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
