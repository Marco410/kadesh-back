import { list } from "@keystone-6/core";
import {
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { animal_history_options } from "../../../utils/constants/constants";

export default list({
  access,
  fields: {
    animal: relationship({
      ref: "Animal",
      many: false,
    }),
    status: select({
      defaultValue: "Registrado",
      options: animal_history_options,
    }),
    notes: text(),
    lat: text(),
    lng: text(),
    last_seen: checkbox(),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
