import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../../models/Role/constants";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
  type SessionLike,
} from "../../../../utils/access/tenant";

/**
 * Configurar WhatsApp de una empresa: admin_company de esa empresa, o admin de plataforma.
 * Mismo criterio que `canManageCompanyAi`.
 */
export function canManageCompanyWhatsapp(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (!hasRole(session, [Role.ADMIN_COMPANY])) return false;
  return getSessionCompanyId(session) === companyId;
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
  return "Solo el administrador de la empresa puede configurar WhatsApp";
}

export function denyCompanyWhatsappUseMessage(session: SessionLike): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para usar WhatsApp";
  }
  return "Este WhatsApp pertenece a otra empresa";
}
