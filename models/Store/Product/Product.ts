import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import {
  ANIMAL_TYPE_OPTIONS,
  BRANDS,
  PRODUCT_CATEGORIES,
} from "../../../utils/constants/constants";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    price: integer({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    category: select({
      validation: { isRequired: true },
      options: PRODUCT_CATEGORIES,
    }),
    brand: select({
      validation: { isRequired: true },
      options: BRANDS,
    }),
    type: select({
      validation: { isRequired: true },
      options: ANIMAL_TYPE_OPTIONS,
    }),
    product_reviews: relationship({
      ref: "Review.product",
      many: true,
    }),
    product_ads: relationship({
      ref: "Ad.product",
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
