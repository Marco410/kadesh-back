import { ListAccessControl } from "@keystone-6/core/types";
import { hasPermission, hasRole } from "../../../auth/permissions";
import { PERMISSION_KEYS } from "../../../auth/permissionsCatalog";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

function canCreateWorkspace(session: any): boolean {
  return hasPermission(session, PERMISSION_KEYS.ESPACIOS_CREAR, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
}

function canManageMembers(session: any): boolean {
  return hasPermission(session, PERMISSION_KEYS.ESPACIOS_MIEMBROS, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
}

function workspaceFilter(session: any) {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }

  const companyId = getCompanyId(session);

  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    if (!companyId) return false;
    return { company: { id: { equals: companyId } } };
  }

  // Lista explícita con espacios.ver: ve los espacios de la empresa.
  if (
    companyId &&
    hasPermission(session, PERMISSION_KEYS.ESPACIOS_VER, () => false)
  ) {
    return { company: { id: { equals: companyId } } };
  }

  const userId = getUserId(session);
  if (!userId) return false;
  return { members: { some: { id: { equals: userId } } } };
}

/**
 * Workspaces por tenant (SaasCompany). Admin global ve todos.
 * Crear / gestionar miembros: permiso o admin_company legado.
 */
export const saasWorkspaceAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      !!getCompanyId(session) && canCreateWorkspace(session),
    update: ({ session }: any) => canManageMembers(session),
    delete: ({ session }: any) => canManageMembers(session),
  },
  filter: {
    query: ({ session }: any) => workspaceFilter(session),
    update: ({ session }: any) => workspaceFilter(session),
    delete: ({ session }: any) => workspaceFilter(session),
  },
};
