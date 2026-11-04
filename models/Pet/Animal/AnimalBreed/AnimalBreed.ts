import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";
import { publicReadAdminWriteAccess } from "../../../../utils/access/presets";

export default list({
  access: publicReadAdminWriteAccess,
  fields: {
    breed: text(),
    animal_type: relationship({
      ref: "AnimalType.animal_breed",
    }),
  },
  ui: {
    labelField: "breed",
  }
});
