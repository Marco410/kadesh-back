import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { dayOfWeek } from "../../utils/constants/constants";

export default list({
  access,
  fields: {
    rating: integer(),
    review: text(),
    veterinary: relationship({
      ref: "Veterinary.veterinary_reviews",
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});

export const dayNames: { [key: number]: string } = {
  0: dayOfWeek.DOM,
  1: dayOfWeek.LUN,
  2: dayOfWeek.MAR,
  3: dayOfWeek.MIER,
  4: dayOfWeek.JUEV,
  5: dayOfWeek.VIE,
  6: dayOfWeek.SAB,
};
