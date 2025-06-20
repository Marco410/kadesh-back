import { list } from "@keystone-6/core";
import { integer, relationship, select } from "@keystone-6/core/fields";
import {
  ANIMAL_TYPE_OPTIONS,
  AnimalTypes,
} from "../../../utils/constants/constants";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: select({
      defaultValue: AnimalTypes.DOG,
      options: ANIMAL_TYPE_OPTIONS,
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    animal_breed: relationship({
      ref: "AnimalBreed.animal_type",
      many: true,
    }),
    order: integer(),
  },
  ui: {
    labelField: "name",
  }
});
