import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { dayOfWeek } from "../../utils/constants/constants";

export default list({
  access,
  fields: {
    day: select({
      options: [
        dayOfWeek.DOM,
        dayOfWeek.LUN,
        dayOfWeek.MAR,
        dayOfWeek.MIER,
        dayOfWeek.JUEV,
        dayOfWeek.VIE,
        dayOfWeek.SAB,
      ],
      validation: { isRequired: true },
    }),
    timeIni: integer({ validation: { isRequired: true } }),
    timeEnd: integer({ validation: { isRequired: true } }),
    veterinary: relationship({
      ref: "Veterinary.veterinary_schedules",
    }),
    pet_shelter: relationship({
      ref: "PetShelter.pet_shelter_schedules",
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
