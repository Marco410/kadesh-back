import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  timestamp,
} from "@keystone-6/core/fields";
import { publicReadAdminWriteAccess } from "../../../utils/access/presets";

export default list({
  access: publicReadAdminWriteAccess,
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

