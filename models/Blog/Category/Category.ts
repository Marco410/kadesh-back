import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  timestamp,
  image,
  select,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { POST_CATEGORIES } from "../../../utils/constants/constants";
import { categoryUrlHook } from "./Category.hooks";

export default list({
  access,
  fields: {
    name: select({ 
      options: POST_CATEGORIES,
      isIndexed: "unique",
    }),
    url: text({
      isIndexed: "unique",
      hooks: categoryUrlHook,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    image: image({
      storage: "s3_categories",
    }),
    posts: relationship({
      ref: "Post.category",
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

