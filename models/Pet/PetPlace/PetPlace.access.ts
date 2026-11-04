import type { ListAccessControl } from "@keystone-6/core/types";
import { adminOnly, adminOnlyField, anyone, signedIn } from "../../../utils/access/presets";
import { getSessionUserId, isPlatformAdmin } from "../../../utils/access/tenant";

/**
 * Fichas de veterinarias. Todas son públicas (directorio, ficha, SEO); crear exige sesión
 * (`/veterinarias/registro`) y queda a nombre de quien la crea (`PetPlace.hooks.ts`); editar y
 * borrar es del admin. El dueño edita su ficha con `updateMyPetPlace` y la reclama con
 * `claimPetPlace` (ambos sudo).
 */
export const petPlaceAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: adminOnly, delete: adminOnly },
};

type FieldAccessArgs = { session?: unknown; item?: { userId?: string | null } | null };

/** Datos del reclamo (teléfono, notas, rol, fecha): solo el dueño de la ficha o el admin. */
export const ownerOrAdminRead = ({ session, item }: FieldAccessArgs) => {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return Boolean(userId && item?.userId === userId);
};

/**
 * Campo privado: lo leen el dueño o el admin, pero solo el admin filtra u ordena por él (si no,
 * se podría adivinar un teléfono con `where: { claimPhone: { contains } }`). Van como función para
 * no cambiar el schema.
 */
export const ownerPrivateField = {
  access: { read: ownerOrAdminRead },
  isFilterable: adminOnlyField,
  isOrderable: adminOnlyField,
};

/** Campos internos de Kadesh (pipeline comercial): solo el admin los lee, filtra o manda. */
export const adminInternalField = {
  access: { read: adminOnlyField, create: adminOnlyField, update: adminOnlyField },
  isFilterable: adminOnlyField,
  isOrderable: adminOnlyField,
};

/** Campos que llena Kadesh o el servidor (verificación, slug, Google, relaciones): no se mandan al registrar. */
export const adminCreateOnly = { access: { create: adminOnlyField } };
