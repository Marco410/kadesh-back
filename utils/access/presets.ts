import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import { isSudoContext } from "../activity/listActivityHooks";
import { getSessionUserId, isPlatformAdmin, isSignedIn } from "./tenant";

/**
 * Reglas de acceso reutilizables. Reemplazan al acceso abierto genérico que dejaba a cualquiera,
 * sin sesión, leer, editar o borrar cualquier fila por API.
 *
 * Recordatorios de Keystone 6:
 * - Una lectura denegada no lanza error: devuelve null, `[]` o 0. Por eso los conteos públicos
 *   (comentarios, likes, calificación) necesitan lectura pública en su list.
 * - `connect` necesita poder leer el destino con las reglas de quien llama.
 * - create y update devuelven el item sin pasar por la regla de query.
 * - Para ocultar un campo del filtro sin cambiar el schema, `isFilterable`/`isOrderable` van como
 *   función (un `false` literal quita el campo del schema).
 */

type AccessArgs = { session?: unknown };

export const anyone = () => true;
export const nobody = () => false;
export const signedIn = ({ session }: AccessArgs) => isSignedIn(session as any);
export const adminOnly = ({ session }: AccessArgs) => isPlatformAdmin(session as any);

/** Filas propias (`user` = la sesión); el admin de plataforma ve todas. */
export function ownRowWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { user: { id: { equals: userId } } };
}

/** Solo el admin de plataforma: listas internas o sin uso en ningún front. */
export const adminOnlyAccess: ListAccessControl<any> = {
  operation: { query: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
};

/** Catálogos: cualquiera lee (páginas públicas y `connect`), solo el admin escribe. */
export const publicReadAdminWriteAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
};

/**
 * Formularios públicos (contacto, suscripción): cualquiera crea, solo el admin lee y edita.
 * El create devuelve los campos pedidos aunque la query esté cerrada.
 */
export const anonymousCreateAccess: ListAccessControl<any> = {
  operation: { query: adminOnly, create: anyone, update: adminOnly, delete: adminOnly },
};

/**
 * Interacciones de una persona (comentario, like, favorito, reseña): lectura pública para los
 * conteos; crear con sesión y a nombre propio (`forceSessionUser`); editar solo admin; borrar el
 * autor o un admin.
 */
export const userRowAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: adminOnly, delete: signedIn },
  filter: { delete: ownRowWhere },
};

/** Vistas: se registran también sin sesión; nadie las edita y solo un admin las borra. */
export const viewRowAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: anyone, update: nobody, delete: adminOnly },
};

/** Acceso de campo: solo el admin de plataforma. */
export const adminOnlyField = ({ session }: AccessArgs) => isPlatformAdmin(session as any);

/**
 * La fila nueva queda a nombre de quien tiene la sesión (o de nadie, si es anónima): el cliente
 * ya no puede firmar por otra persona. Un admin y `sudo()` no cambian.
 */
export function forceSessionUser(
  resolvedData: Record<string, any>,
  operation: string,
  context: KeystoneContext,
): Record<string, any> {
  if (operation !== "create" || isSudoContext(context) || isPlatformAdmin(context.session)) {
    return resolvedData;
  }
  const userId = getSessionUserId(context.session);
  const next = { ...resolvedData };
  if (userId) next.user = { connect: { id: userId } };
  else delete next.user;
  return next;
}

/** ¿La petición viene de alguien que no es admin ni del servidor (sudo)? */
export function isClientNonAdmin(context: KeystoneContext): boolean {
  return !isSudoContext(context) && !isPlatformAdmin(context.session);
}
