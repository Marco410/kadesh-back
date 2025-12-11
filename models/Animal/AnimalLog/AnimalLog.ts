import { list } from "@keystone-6/core";
import {
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { ANIMAL_LOGS_OPTIONS } from "../../../utils/constants/constants";

export default list({
  access,
  fields: {
    animal: relationship({
      ref: "Animal.logs",
    }),
    status: select({
      defaultValue: "Registrado",
      options: ANIMAL_LOGS_OPTIONS,
    }),
    notes: text({
      ui: { displayMode: "textarea" },
    }),
    lat: text(),
    lng: text(),
    address: text(),
    city: text(),
    state: text(),
    country: text(),
    last_seen: checkbox(),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
