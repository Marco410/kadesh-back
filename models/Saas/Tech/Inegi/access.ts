import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { isSignedIn } from "../../../../utils/access/tenant";

/**
 * Catálogo público INEGI: lectura abierta, escrituras solo vía sudo
 * (mutaciones custom y scripts de import).
 */
export const inegiCatalogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
};

/**
 * Logs de sync INEGI: visibles para usuarios autenticados.
 * Altas solo vía sudo.
 */
export const inegiSyncLogAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
};
