import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

const companyWorkspaceFilter = (companyId: string) => ({
  workspace: { company: { id: { equals: companyId } } },
});

const memberWorkspaceFilter = (userId: string) => ({
  workspace: { members: { some: { id: { equals: userId } } } },
});

function workspaceCrmStatusFilter(session: any) {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }

  const companyId = getCompanyId(session);
  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    if (!companyId) return false;
    return companyWorkspaceFilter(companyId);
  }

  const userId = getUserId(session);
  if (!userId) return false;
  return memberWorkspaceFilter(userId);
}

/**
 * Estados CRM configurables por workspace; acotados por empresa del tenant.
 */
export const saasWorkspaceCrmStatusAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => workspaceCrmStatusFilter(session),
    update: ({ session }: any) => workspaceCrmStatusFilter(session),
    delete: ({ session }: any) => workspaceCrmStatusFilter(session),
  },
};
