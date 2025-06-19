import { list } from "@keystone-6/core";
import {
  calendarDay,
  checkbox,
  float,
  image,
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { types_ad } from "../../utils/constants/constants";

export default list({
  access,
  fields: {
    title: text(),
    description: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    active: checkbox(),
    start_date: calendarDay(),
    end_date: calendarDay(),
    price: integer(),
    type: select({
      options: types_ad,
    }),
    lat: text(),
    lng: text(),
    image: image({
      storage: "s3_files",
    }),
    pet_place: relationship({
      ref: "PetPlace.pet_place_ads",
    }),
    product: relationship({
      ref: "Product.product_ads",
    }),
    user: relationship({
      ref: "User",
      many: false,
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
