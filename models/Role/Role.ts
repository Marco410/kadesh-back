import { list } from "@keystone-6/core";
import {
  relationship,
  timestamp,
  select,
} from "@keystone-6/core/fields";
import { roleAccess, roleUsersFieldAccess } from "./Role.access";
import { ROLES } from "./constants";

export default list({
  access: roleAccess,
  fields: {
      name: select({ 
        options: ROLES,
        isIndexed: "unique",
    }),
    users: relationship({
      ref: "User.roles",
      many: true,
      access: roleUsersFieldAccess,
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

