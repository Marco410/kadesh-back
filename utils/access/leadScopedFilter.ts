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

/**
 * TechWhatsAppMessage. Tres tipos de conversación y quién ve cada una:
 *
 * - **Con un lead**: mismo criterio que el lead (un vendedor solo ve los leads que tiene
 *   asignados). Asignar un chat a un vendedor = asignarle el lead, no hay un segundo campo.
 * - **Interna (con alguien del equipo)**: solo el `teamMember` y quien abrió el chat
 *   (`internalInitiator`).
 * - **Sin matchear** (ni lead ni teamMember: llegó un número desconocido): solo admins.
 *
 * El admin de empresa ve todo lo de su empresa, incluidos los mensajes sin matchear — por eso
 * se filtra por `company` y no por el lead (un filtro anidado sobre `businessLead` nunca
 * matchea las filas que lo tienen vacío).
 */
export function whatsappMessageScopedWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;

  const companyId = getSessionCompanyId(session);
  const userId = getSessionUserId(session);
  if (!companyId) return false;

  const inCompany = { company: { id: { equals: companyId } } };

  if (hasRole(session, [Role.ADMIN_COMPANY])) return inCompany;

  if (!userId) return false;

  const leadWhere = leadCompanyScopedWhere(session);
  const visible: Record<string, unknown>[] = [
    { teamMember: { id: { equals: userId } } },
    { internalInitiator: { id: { equals: userId } } },
  ];
  if (leadWhere !== false) {
    visible.push(
      leadWhere === true ? { businessLead: {} } : { businessLead: leadWhere },
    );
  }

  return { AND: [inCompany, { OR: visible }] };
}
