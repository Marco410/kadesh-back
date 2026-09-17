import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
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
