import { ListAccessControl } from "@keystone-6/core/types";

/** Acceso abierto: sin restricciones por rol. */
export const businessLeadAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: () => true,
    update: () => true,
    delete: () => true,
  },
};
