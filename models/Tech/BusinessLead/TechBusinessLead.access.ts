import { ListAccessControl } from "@keystone-6/core/types";
import { Role } from "../../Role/constants";
import { hasRole } from "../../../auth/permissions";

/**
 * Admin: ve y gestiona todo.
 * Vendedor: solo ve y gestiona leads donde assignedSeller = session.userId.
 * Solo Admin puede eliminar.
 */
export const businessLeadAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    create: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    update: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    delete: ({ session }) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }) => {
      if (!session?.data?.id) return false;
      if (session.data.role === Role.ADMIN) return true;
      if (session.data.role === Role.VENDEDOR) {
        return { assignedSeller: { id: { equals: session.data.id } } };
      }
      return false;
    },
    update: ({ session }) => {
      if (!session?.data?.id) return false;
      if (session.data.role === Role.ADMIN) return true;
      if (session.data.role === Role.VENDEDOR) {
        return { assignedSeller: { id: { equals: session.data.id } } };
      }
      return false;
    },
    delete: ({ session }) => session?.data?.role === Role.ADMIN,
  },
};
