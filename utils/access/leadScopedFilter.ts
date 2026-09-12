import { hasRole } from "../../auth/permissions";
import { Role } from "../../models/Role/constants";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
} from "./tenant";

function leadInCompany(companyId: string) {
  return { saasCompany: { some: { id: { equals: companyId } } } };
}

function leadAssignedToUser(companyId: string, userId: string) {
  return {
    AND: [
      leadInCompany(companyId),
      {
        OR: [
          { salesPerson: { some: { id: { equals: userId } } } },
          {
            status: {
              some: {
                saasCompany: { id: { equals: companyId } },
                salesPerson: { id: { equals: userId } },
              },
            },
          },
        ],
      },
    ],
  };
}

/**
 * TechBusinessLead: admin ve todo; admin_company ve los de su empresa;
 * vendedor / resto de la empresa solo los asignados a él.
 */
export function leadCompanyScopedWhere(session: any): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;

  const companyId = getSessionCompanyId(session);
  const userId = getSessionUserId(session);
  if (!companyId) return false;

  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    return leadInCompany(companyId);
  }

  if (!userId) return false;
  return leadAssignedToUser(companyId, userId);
}

function statusInCompany(companyId: string) {
  return {
    OR: [
      { saasCompany: { id: { equals: companyId } } },
      {
        businessLead: {
          saasCompany: { some: { id: { equals: companyId } } },
        },
      },
    ],
  };
}

/**
 * TechStatusBusinessLead: mismo criterio de tenant / asignación que el lead.
 */
export function statusLeadCompanyScopedWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;

  const companyId = getSessionCompanyId(session);
  const userId = getSessionUserId(session);
  if (!companyId) return false;

  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    return statusInCompany(companyId);
  }

  if (!userId) return false;
  return {
    AND: [
      statusInCompany(companyId),
      { salesPerson: { id: { equals: userId } } },
    ],
  };
}
