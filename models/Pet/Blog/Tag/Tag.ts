import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: text({ 
      validation: { isRequired: true },
      isIndexed: "unique",
    }),
    posts: relationship({
      ref: "Post.tags",
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

