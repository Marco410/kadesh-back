import { ListAccessControl } from "@keystone-6/core/types";
import { crmWorkspaceScopedWhere } from "../../../utils/access/crmWorkspaceScopedFilter";

const getCompanyId = (session: any) => session?.data?.company?.id;

export const proposalAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => crmWorkspaceScopedWhere(session),
    update: ({ session }: any) => crmWorkspaceScopedWhere(session),
    delete: ({ session }: any) => crmWorkspaceScopedWhere(session),
  },
};
