import { hasRole } from "../../auth/permissions";
import { Role } from "../../models/Role/constants";

const getCompanyId = (session: any) =>
  session?.data?.company?.id as string | undefined;
const getUserId = (session: any) => session?.data?.id as string | undefined;

/**
 * Items CRM (actividad, propuesta, follow-up) visibles si:
 * - sin workspace y el lead pertenece a la empresa del usuario, o
 * - con workspace donde el usuario es miembro y el workspace es de su empresa.
 */
export function crmWorkspaceScopedWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }
  const companyId = getCompanyId(session);
  const userId = getUserId(session);
  if (!companyId || !userId) {
    return false;
  }
  return {
    OR: [
      {
        AND: [
          // Prisma-style: optional relation unset (legacy CRM rows)
          { workspace: null },
          {
            businessLead: {
              saasCompany: { some: { id: { equals: companyId } } },
            },
          },
        ],
      },
      {
        AND: [
          {
            workspace: {
              members: { some: { id: { equals: userId } } },
            },
          },
          {
            workspace: {
              company: { id: { equals: companyId } },
            },
          },
        ],
      },
    ],
  };
}
