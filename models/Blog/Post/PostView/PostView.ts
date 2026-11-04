import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { forceSessionUser, viewRowAccess } from "../../../../utils/access/presets";

export default list({
  access: viewRowAccess,
  hooks: {
    // A nombre de quien tiene la sesión: el cliente no puede firmar por otra persona.
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    user: relationship({
      ref: "User",
      many: false,
    }),
    post: relationship({
      ref: "Post.post_views",
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
  },
});

