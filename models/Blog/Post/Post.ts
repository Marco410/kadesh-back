import { list } from "@keystone-6/core";
import {
  text,
  checkbox,
  image,
  relationship,
  timestamp,
  select,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { PRODUCT, PRODUCT_OPTIONS } from "../../../utils/constants/product";
import {
  postUrlHook,
  publishedAtHook,
  postPublishSideEffectsHook,
  postCategoryProductHook,
} from "./Post.hooks";
import { document } from '@keystone-6/fields-document';

export default list({
  access,
  hooks: {
    resolveInput: publishedAtHook.resolveInput,
    validateInput: postCategoryProductHook.validateInput,
    afterOperation: postPublishSideEffectsHook.afterOperation,
  },
  ui: {
    listView: {
      initialColumns: ["title", "product", "category", "published", "publishedAt"],
    },
  },
  fields: {
    product: select({
      options: PRODUCT_OPTIONS,
      defaultValue: PRODUCT.PET,
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        displayMode: "select",
        description: "Pet, SaaS o ambas apps. Su categoría debe ser del mismo producto.",
      },
    }),
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
      ui: {
        description:
          "Marca esto y deja \"Published at\" vacío para publicar de inmediato, o ponle una fecha futura para programarlo.",
      },
    }),
    publishedAt: timestamp({
      ui: {
        createView: { fieldMode: "edit" },
        itemView: { fieldMode: "edit" },
        description:
          "Vacío = se llena solo al marcar \"Published\". Con una fecha futura, el post queda oculto en el sitio hasta esa fecha.",
      },
    }),
    /** Cuándo se mandó el correo de "nuevo post". No editable: evita reenvíos en guardados posteriores. */
    publishedNotifiedAt: timestamp({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    /** Cuándo se publicó en la Página de Facebook. Editable: vaciarlo fuerza un reintento. */
    publishedToFacebookAt: timestamp({
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "edit" },
        description:
          "Se llena solo al publicarse en Facebook. Bórralo para forzar un reintento (ej. después de renovar un token vencido).",
      },
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
    post_views: relationship({
      ref: "PostView.post",
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

