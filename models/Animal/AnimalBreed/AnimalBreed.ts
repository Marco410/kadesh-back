import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    breed: text(),
    animal_type: relationship({
      ref: "AnimalType",
      many: false,
    }),
    order: integer(),
  },
});
