import { list } from "@keystone-6/core";
import { integer, select } from "@keystone-6/core/fields";
import {
  animal_type_options,
  AnimalTypes,
} from "../../../utils/constants/constants";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: select({
      defaultValue: AnimalTypes.DOG,
      options: animal_type_options,
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    order: integer(),
  },
});
