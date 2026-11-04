import type { ListAccessControl } from "@keystone-6/core/types";
import { adminOnly, anyone } from "../../../utils/access/presets";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/**
 * Posts del blog: el público solo ve los publicados cuya fecha ya llegó (o sin fecha); los
 * borradores y programados solo los ve el admin. Escribir es solo del admin; ClickUp y la
 * publicación programada usan `sudo()`.
 *
 * Un post oculto sale como `null` en relaciones (likes, favoritos y comentarios de una persona):
 * los fronts filtran esas filas.
 */
export const postAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: {
    query: ({ session }: { session?: unknown }) => {
      if (isPlatformAdmin(session as any)) return true;
      return {
        published: { equals: true },
        OR: [{ publishedAt: { equals: null } }, { publishedAt: { lte: new Date().toISOString() } }],
      };
    },
  },
};
