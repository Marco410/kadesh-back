import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import { forceSessionUser, userRowAccess } from "../../../../utils/access/presets";

export default list({
  access: userRowAccess,
  hooks: {
    // A nombre de quien tiene la sesión: el cliente no puede firmar por otra persona.
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    comment: text({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" },
    }),
    post: relationship({
      ref: "Post.comments",
      many: false,
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
    updatedAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      db: {
        updatedAt: true,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
  },
});

