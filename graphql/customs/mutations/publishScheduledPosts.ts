import { notifyNewPostIfDue } from "../../../models/Blog/Post/Post.hooks";

const typeDefs = `
  type PublishScheduledPostsResult {
    success: Boolean!
    message: String!
    checked: Int!
  }

  type Mutation {
    publishScheduledPosts(secret: String!): PublishScheduledPostsResult!
  }
`;

const definition = `
  publishScheduledPosts(secret: String!): PublishScheduledPostsResult!
`;

const resolver = {
  /**
   * Pensada para un cron externo (GitHub Actions, ver .github/workflows/publish-scheduled-posts.yml),
   * no para un usuario logueado: se autoriza con `CRON_SECRET`, no con sesión/rol.
   *
   * La visibilidad de un post programado (`publishedAt` a futuro) ya funciona sola —los fronts
   * filtran por fecha en cada lectura, sin cron—. Lo único que este mutation resuelve es que el
   * correo de "nuevo post" salga cerca de la fecha programada aunque nadie vuelva a abrir el
   * post en el admin. Reusa `notifyNewPostIfDue`, la misma función que dispara el hook al
   * crear/editar, así que nunca duplica un envío ya hecho.
   */
  publishScheduledPosts: async (
    _root: unknown,
    { secret }: { secret: string },
    context: any,
  ) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) {
      return { success: false, message: "No autorizado.", checked: 0 };
    }

    try {
      const now = new Date().toISOString();
      const duePosts = await context.sudo().db.Post.findMany({
        where: {
          published: { equals: true },
          publishedAt: { lte: now },
          publishedNotifiedAt: { equals: null },
        },
      });

      for (const post of duePosts) {
        await notifyNewPostIfDue(post, context);
      }

      return {
        success: true,
        message: `Revisados ${duePosts.length} post(s) pendientes de notificar.`,
        checked: duePosts.length,
      };
    } catch (error) {
      console.error("Error en publishScheduledPosts:", error);
      return {
        success: false,
        message: "Error al procesar los posts programados.",
        checked: 0,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
