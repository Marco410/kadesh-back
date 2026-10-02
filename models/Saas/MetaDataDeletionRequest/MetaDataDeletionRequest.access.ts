import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

/**
 * El Admin UI solo lo ve un ADMIN. El webhook escribe con `context.sudo()`.
 */
export const metaDataDeletionRequestAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }) => hasRole(session, [Role.ADMIN]),
    create: () => false,
    update: ({ session }) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }) => hasRole(session, [Role.ADMIN]),
    update: ({ session }) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }) => hasRole(session, [Role.ADMIN]),
  },
};
