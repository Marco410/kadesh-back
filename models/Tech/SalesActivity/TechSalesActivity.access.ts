import { ListAccessControl } from "@keystone-6/core/types";
import { Role } from "../../Role/constants";
import { hasRole } from "../../../auth/permissions";

/** Vendedor solo ve actividades de sus leads; Admin ve todo. */
export const salesActivityAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    create: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    update: ({ session }) => hasRole(session, [Role.VENDEDOR]),
    delete: ({ session }) => hasRole(session, [Role.VENDEDOR]),
  },
  filter: {
    query: ({ session }) => {
      if (!session?.data?.id) return false;
      if (session.data.role === Role.ADMIN) return true;
      if (session.data.role === Role.VENDEDOR) {
        return {
          businessLead: { assignedSeller: { id: { equals: session.data.id } } },
        };
      }
      return false;
    },
    update: ({ session }) => {
      if (!session?.data?.id) return false;
      if (session.data.role === Role.ADMIN) return true;
      if (session.data.role === Role.VENDEDOR) {
        return {
          businessLead: { assignedSeller: { id: { equals: session.data.id } } },
        };
      }
      return false;
    },
    delete: ({ session }) => {
      if (!session?.data?.id) return false;
      if (session.data.role === Role.ADMIN) return true;
      if (session.data.role === Role.VENDEDOR) {
        return {
          businessLead: { assignedSeller: { id: { equals: session.data.id } } },
        };
      }
      return false;
    },
  },
};
