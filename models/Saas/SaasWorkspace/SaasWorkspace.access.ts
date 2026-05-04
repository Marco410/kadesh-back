import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

function workspaceFilter(session: any) {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }

  const companyId = getCompanyId(session);
  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    if (!companyId) return false;
    return { company: { id: { equals: companyId } } };
  }

  const userId = getUserId(session);
  if (!userId) return false;
  return { members: { some: { id: { equals: userId } } } };
}

/**
 * Workspaces por tenant (SaasCompany). Admin global ve todos.
 */
export const saasWorkspaceAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => workspaceFilter(session),
    update: ({ session }: any) => workspaceFilter(session),
    delete: ({ session }: any) => workspaceFilter(session),
  },
};
