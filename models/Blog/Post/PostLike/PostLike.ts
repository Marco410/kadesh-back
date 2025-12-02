import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import access from "../../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    user: relationship({
      ref: "User",
      many: false,
    }),
    post: relationship({
      ref: "Post.post_likes",
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

