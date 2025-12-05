import { list } from "@keystone-6/core";
import {
  relationship,
  timestamp,
  select,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { ROLES } from "./constants";

export default list({
  access,
  fields: {
      name: select({ 
        options: ROLES,
        isIndexed: "unique",
    }),
    users: relationship({
      ref: "User.roles",
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

