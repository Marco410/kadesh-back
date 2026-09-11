import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";
import {
  getSessionCompanyId,
  isCompanyAdmin,
  isPlatformAdmin,
  isSignedIn,
} from "../../../utils/access/tenant";

/**
 * Empresas (tenants): el usuario solo ve y edita la suya (session.company).
 * Crear requiere sesión (p. ej. EmptyCompanySection). El registro público
 * crea la empresa vía registerUser (sudo), no con createSaasCompany.
 * Borrar: solo admin de plataforma.
 */
export const saasCompanyAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) => isSignedIn(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    update: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    delete: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      return false;
    },
  },
};

export const aiApiKeyPreviewFieldAccess = {
  read: ({ session, item }: any) => {
    if (isPlatformAdmin(session)) return true;
    if (!isCompanyAdmin(session)) return false;
    return getSessionCompanyId(session) === item?.id;
  },
  create: () => false,
  update: () => false,
};
