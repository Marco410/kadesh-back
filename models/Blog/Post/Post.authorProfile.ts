import { graphql } from "@keystone-6/core";
import { virtual } from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Lo que el blog público muestra de quien escribió un post.
 *
 * `Post.author` apunta a `User`, y `User` solo se lee con sesión (y casi siempre solo a uno
 * mismo), así que a un visitante `author` le llega `null` aunque el post tenga autor. Este campo
 * lee con `sudo()` solo estos datos públicos, sin correo ni teléfono, y únicamente de los posts
 * que esa persona ya puede ver (los publicados, por el filtro de `Post.access.ts`).
 */
type PostAuthorProfileSource = {
  name: string | null;
  lastName: string | null;
  username: string | null;
  verified: boolean | null;
  createdAt: string | null;
  profileImage: { url: string } | null;
};

const PostAuthorImage = graphql.object<{ url: string }>()({
  name: "PostAuthorImage",
  fields: {
    url: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
});

const PostAuthorProfile = graphql.object<PostAuthorProfileSource>()({
  name: "PostAuthorProfile",
  fields: {
    name: graphql.field({ type: graphql.String }),
    lastName: graphql.field({ type: graphql.String }),
    username: graphql.field({ type: graphql.String }),
    verified: graphql.field({ type: graphql.Boolean }),
    createdAt: graphql.field({ type: graphql.String }),
    profileImage: graphql.field({ type: PostAuthorImage }),
  },
});

export const postAuthorProfileField = virtual({
  field: graphql.field({
    type: PostAuthorProfile,
    async resolve(item: any, _args: unknown, context: KeystoneContext) {
      if (!item?.authorId) return null;
      const user = (await context.sudo().query.User.findOne({
        where: { id: item.authorId },
        query: "name lastName username verified createdAt profileImage { url }",
      })) as PostAuthorProfileSource | null;
      return user ?? null;
    },
  }),
  ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
});
