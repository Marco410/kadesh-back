import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    animal: relationship({
      ref: "Animal",
      many: false,
    }),
    status: select({
      defaultValue: "Registrado",
      options: [
        {
          label: "Registrado",
          value: "Registrado",
        },
        {
          label: "Adoptado",
          value: "Adoptado",
        },
        {
          label: "Abandonado",
          value: "Abandonado",
        },
        {
          label: "Rescatado",
          value: "Rescatado",
        },
        {
          label: "En familia",
          value: "En familia",
        },
      ],
    }),
    notes: text(),
    lat: text(),
    lng: text(),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
