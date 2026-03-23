import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../auth/permissions";
import { Role } from "../Role/constants";

/**
 */
export const systemReleaseAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }) => hasRole(session, [Role.ADMIN]),
    update: ({ session }) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }) => {
      if (hasRole(session, [Role.ADMIN])) return true;
      return { isPublished: { equals: true } };
    },
    update: ({ session }) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }) => hasRole(session, [Role.ADMIN]),
  },
};
