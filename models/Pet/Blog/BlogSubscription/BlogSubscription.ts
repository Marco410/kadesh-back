import { list } from "@keystone-6/core";
import {
  text,
  checkbox,
  relationship,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    email: text({
      isIndexed: "unique",
      ui: {
        displayMode: "input",
      },
    }),
    user: relationship({
      ref: "User.blog_subscriptions",
      many: false,
      ui: {
        displayMode: "select",
      },
    }),
    active: checkbox({
      defaultValue: true,
      ui: {
        description: "Si está activo, recibirá notificaciones de nuevos posts",
      },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
  ui: {
    labelField: "email",
    listView: {
      initialColumns: ["email", "user", "active", "createdAt"],
    },
  },
});
