import { ListAccessControl } from "@keystone-6/core/types";
import { hasPermission, hasRole } from "../../../../auth/permissions";
import { PERMISSION_KEYS } from "../../../../auth/permissionsCatalog";
import { Role } from "../../../Role/constants";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

function canUploadFiles(session: any): boolean {
  return hasPermission(session, PERMISSION_KEYS.ARCHIVOS_SUBIR, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
}

function canDeleteFiles(session: any): boolean {
  return hasPermission(session, PERMISSION_KEYS.ARCHIVOS_ELIMINAR, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
}

/**
 * TechFiles: solo se ven/editan/borran los archivos de la SaasCompany del usuario.
 * Subir/eliminar respetan permisos (`archivos.subir` / `archivos.eliminar`).
 */
export const techFilesAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) =>
      isPlatformAdmin(session) ||
      (!!getSessionCompanyId(session) && canUploadFiles(session)),
    update: ({ session }: any) =>
      isPlatformAdmin(session) || canUploadFiles(session),
    delete: ({ session }: any) =>
      isPlatformAdmin(session) || canDeleteFiles(session),
  },
  filter: {
    query: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      if (!canUploadFiles(session)) return false;
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      if (!canDeleteFiles(session)) return false;
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
