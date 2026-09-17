import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { ANIMAL_SEX_OPTIONS } from "../../utils/constants/constants";
import { animalSlugAfterOperation } from "./Animal.hooks";

export default list({
  access,
  hooks: animalSlugAfterOperation,
  ui: {
    listView: {
      initialColumns: ["name", "slug", "createdAt"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "URL amigable. Se genera sola y no cambia si editas el nombre.",
      },
    }),
    physical_description: text(),
    age: text(),
    sex: select({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "male",
    }),
    color: text(),
    size: text(),
    contactNumber: text(),
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
