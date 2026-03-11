import { ListAccessControl } from "@keystone-6/core/types";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * TechFiles: solo se ven/editan/borran los archivos que pertenecen a la SaasCompany del usuario.
 * Crear solo si el usuario tiene company.
 */
export const techFilesAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => {
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
