import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";

const getCompanyId = (session: any) => session?.data?.company?.id;

export const quotationProductAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    // Admin de plataforma lee partidas de cotizaciones de cualquier empresa.
    query: ({ session }: any) => {
      if (isPlatformAdmin(session)) return true;
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    },
    update: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    },
    delete: ({ session }: any) => {
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { quotation: { company: { id: { equals: companyId } } } };
    },
  },
};
