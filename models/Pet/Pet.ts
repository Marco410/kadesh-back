import { graphql, list } from "@keystone-6/core";
import {
  calendarDay,
  relationship,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    birthday: calendarDay({ validation: { isRequired: true } }),
    age: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any) {
          if (item?.birthday) {
            const today = new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        },
      }),
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
      ref: "PetMultimedia.pet",
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
