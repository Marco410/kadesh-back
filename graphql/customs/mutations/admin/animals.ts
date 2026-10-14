import type { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { publishAnimalToFacebookById } from "../../../../models/Pet/Animal/Animal.hooks";

/**
 * Acciones de Operaciones sobre animales de Kadesh Pet. Solo admin de plataforma.
 * `AdminOpsActionResult` se declara en `companyOps.ts`.
 */

const typeDefs = `
  type Mutation {
    adminPublishAnimalToFacebook(animalId: ID!, force: Boolean): AdminOpsActionResult!
    adminPurgeAnimalViews(animalId: ID!, onlyAnonymous: Boolean): AdminOpsActionResult!
  }
`;

const definition = `
  adminPublishAnimalToFacebook(animalId: ID!, force: Boolean): AdminOpsActionResult!
  adminPurgeAnimalViews(animalId: ID!, onlyAnonymous: Boolean): AdminOpsActionResult!
`;

function deny() {
  return { success: false, message: "Solo un administrador de Kadesh puede hacer esto." };
}

const resolver = {
  /**
   * Publica el animal en la Página de Facebook de Pet. Si ya se publicó, no lo repite salvo
   * `force` (volver a publicar a propósito). Sirve para los que subieron usuarios (no se
   * publican solos) y para reintentar uno que falló.
   */
  adminPublishAnimalToFacebook: async (
    _root: unknown,
    { animalId, force }: { animalId: string; force?: boolean | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) return deny();
    const animal = (await context.sudo().query.Animal.findOne({
      where: { id: animalId },
      query: "id slug facebookPublishedAt",
    })) as { id: string; slug: string | null; facebookPublishedAt: string | null } | null;
    if (!animal) return { success: false, message: "No encontramos ese animal." };
    if (!animal.slug) return { success: false, message: "El animal aún no tiene enlace público." };
    if (animal.facebookPublishedAt && !force) {
      return { success: false, message: "Este animal ya está publicado en Facebook." };
    }

    const postId = await publishAnimalToFacebookById(animalId, context);
    if (!postId) {
      return {
        success: false,
        message: "Facebook no aceptó la publicación. Revisa que la Página de Pet esté conectada.",
      };
    }
    return { success: true, message: "Publicado en la Página de Facebook de Kadesh Pet." };
  },

  /** Borra vistas de un animal (todas o solo las anónimas), p. ej. visitas de prueba o repetidas. */
  adminPurgeAnimalViews: async (
    _root: unknown,
    { animalId, onlyAnonymous }: { animalId: string; onlyAnonymous?: boolean | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) return deny();
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const result = await prisma.animalView.deleteMany({
      where: { animalId, ...(onlyAnonymous ? { userId: null } : {}) },
    });
    if (result instanceof Error) throw result;
    const count = result?.count ?? 0;
    return {
      success: true,
      message: count === 1 ? "Se borró 1 vista." : `Se borraron ${count} vistas.`,
    };
  },
};

export default { typeDefs, definition, resolver };
