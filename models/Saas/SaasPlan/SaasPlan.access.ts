import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/**
 * El catálogo de planes es público (la página de precios lo lee sin sesión),
 * pero solo operaciones (Role.ADMIN) puede crearlo, editarlo o borrarlo:
 * desde aquí se cambian precios y features que afectan cobros reales.
 */
export const saasPlanAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }) => isPlatformAdmin(session),
    update: ({ session }) => isPlatformAdmin(session),
    delete: ({ session }) => isPlatformAdmin(session),
  },
  filter: {
    query: () => true,
  },
};
