import { hasRole } from "../../auth/permissions";
import { Role } from "../../models/Role/constants";

const getCompanyId = (session: any) =>
  session?.data?.company?.id as string | undefined;
const getUserId = (session: any) => session?.data?.id as string | undefined;

export type CrmAssigneeField = "responsible" | "assignedSeller";

export type CrmWorkspaceScopedOptions = {
  assigneeField: CrmAssigneeField;
};

function companyScopedOr(companyId: string) {
  return {
    OR: [
      {
        businessLead: {
          saasCompany: { some: { id: { equals: companyId } } },
        },
      },
      {
        workspace: {
          company: { id: { equals: companyId } },
        },
      },
    ],
  };
}

/**
 * Items CRM (actividad, tarea, propuesta, follow-up):
 * - `admin`: todo.
 * - `admin_company`: todo lo de su empresa (lead legacy o workspace de la empresa).
 * - `user_company`: asignado a él y (lead de la empresa o workspace de la empresa).
 * - otros roles: sin acceso.
 */
export function crmWorkspaceScopedWhere(
  session: any,
  options: CrmWorkspaceScopedOptions,
): true | false | Record<string, unknown> {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }

  const companyId = getCompanyId(session);
  const userId = getUserId(session);
  const assigneeKey = options.assigneeField;

  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    if (!companyId) return false;
    return companyScopedOr(companyId);
  }

  if (hasRole(session, [Role.USER_COMPANY])) {
    if (!companyId || !userId) return false;
    return {
      AND: [
        { [assigneeKey]: { id: { equals: userId } } },
        companyScopedOr(companyId),
      ],
    };
  }

  return false;
}
