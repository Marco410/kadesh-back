import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

/**
 * Admin ve todos los intentos. Usuario autenticado solo sus propios eventos (user vinculado).
 * Intentos fallidos sin user solo los ve admin.
 */
export const userAuthLogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => true,
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
