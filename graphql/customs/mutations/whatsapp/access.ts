import { hasPermission, hasRole } from "../../../../auth/permissions";
import { PERMISSION_KEYS } from "../../../../auth/permissionsCatalog";
import { Role } from "../../../../models/Role/constants";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
  type SessionLike,
} from "../../../../utils/access/tenant";

/**
 * Configurar WhatsApp de una empresa: permiso `whatsapp.configurar`, admin_company
 * legado, o admin de plataforma. Mismo criterio que `canManageCompanyAi`.
 */
export function canManageCompanyWhatsapp(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (getSessionCompanyId(session) !== companyId) return false;
  return hasPermission(session, PERMISSION_KEYS.WHATSAPP_CONFIGURAR, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
}

/**
 * Usar WhatsApp ya configurado (mandar/ver mensajes): cualquier miembro de la empresa, o
 * admin de plataforma. Mismo criterio que `canUseCompanyAi`.
 */
export function canUseCompanyWhatsapp(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  return getSessionCompanyId(session) === companyId;
}

export function denyCompanyWhatsappAccessMessage(session: SessionLike): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para configurar WhatsApp";
  }
  if (!getSessionCompanyId(session)) {
    return "Tu cuenta no tiene una empresa asociada";
  }
  return "No tienes permiso para configurar WhatsApp de la empresa";
}

export function denyCompanyWhatsappUseMessage(session: SessionLike): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para usar WhatsApp";
  }
  return "Este WhatsApp pertenece a otra empresa";
}
