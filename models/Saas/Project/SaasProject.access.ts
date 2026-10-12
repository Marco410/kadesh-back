import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Proyectos: solo se ven/editan/borran los que pertenecen a la SaasCompany del usuario.
 * Crear solo si el usuario tiene company. Admin de plataforma lee los de cualquier empresa.
 */
export const projectAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    delete: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
