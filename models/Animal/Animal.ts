import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
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
    history: relationship({
      ref: "AnimalHistory.animal",
      many: true,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
