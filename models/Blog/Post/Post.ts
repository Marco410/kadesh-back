import { list } from "@keystone-6/core";
import {
  text,
  checkbox,
  image,
  relationship,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { postUrlHook } from "./Post.hooks";
import { document } from '@keystone-6/fields-document';

export default list({
  access,
  fields: {
    title: text({ validation: { isRequired: true } }),
    url: text({
      isIndexed: "unique",
      hooks: postUrlHook,
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    content: document({
      formatting: true,
      dividers: true,
      links: true,
    }),
    excerpt: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    image: image({
      storage: "s3_posts",
    }),
    published: checkbox({
      defaultValue: false,
    }),
    publishedAt: timestamp({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "edit" }
      }
    }),
    category: relationship({
      ref: "Category.posts",
      many: false,
    }),
    tags: relationship({
      ref: "Tag.posts",
      many: true,
    }),
    author: relationship({
      ref: "User",
      many: false,
    }),
    comments: relationship({
      ref: "PostComment.post",
      many: true,
    }),
    post_likes: relationship({
      ref: "PostLike.post",
      many: true,
    }),
    post_favorites: relationship({
      ref: "PostFavorite.post",
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

