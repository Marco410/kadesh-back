import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

/**
 * Admin ve todos los intentos. Usuario autenticado solo sus propios eventos (user vinculado).
 * Intentos fallidos sin user solo los ve admin.
 * Solo el servidor escribe (con `sudo()`): login con contraseña, Google y registro.
 * Por API solo el admin crea, para que nadie pueda inventar accesos.
 */
export const userAuthLogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    update: () => false,
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const userId = session?.data?.id;
      if (!userId) return false;
      return { user: { id: { equals: userId } } };
    },
    update: () => false,
    delete: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      return false;
    },
  },
};
