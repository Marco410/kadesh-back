import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

/**
 * TechFiles: solo se ven/editan/borran los archivos de la SaasCompany del usuario.
 */
export const techFilesAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionCompanyId(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isSignedIn(session),
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
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
