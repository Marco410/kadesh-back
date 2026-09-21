import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../../utils/generalAccess/access";

export default list({
  access,
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

