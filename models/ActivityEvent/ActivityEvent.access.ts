import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../utils/access/tenant";

/**
 * Registro de auditoría: nadie lo escribe ni lo edita por API.
 * Solo el servidor agrega filas (`utils/activity/logActivity.ts`, con sudo).
 * Lo lee y lo borra (retención) solo el admin de plataforma.
 */
export const activityEventAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isPlatformAdmin(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => isPlatformAdmin(session),
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
};
