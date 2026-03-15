import { ListAccessControl } from "@keystone-6/core/types";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Logs de sincronización de leads: solo se ven los de la SaasCompany del usuario.
 */
export const techLeadSyncLogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
