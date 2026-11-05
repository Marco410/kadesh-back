import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
} from "../../../utils/access/tenant";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";
import {
  adminOnly,
  anyone,
  forceSessionUser,
  ownRowWhere,
  signedIn,
} from "../../../utils/access/presets";
import {
  RESCUE_ANIMAL_EDITOR_ROLES,
  RESCUE_ANIMAL_MANAGER_ROLES,
  RESCUE_ORG_ACTIVE_STATUSES,
} from "../RescueOrganization/constants";
import { findRescueMemberRole, rescueOrgMemberFilter } from "../RescueOrganization/RescueOrganization.access";

export { forceSessionUser, ownRowWhere };

/**
 * Animales de Kadesh Pet: la ficha es pública (cualquiera la ve), pero solo el dueño o un admin
 * de plataforma la cambia. Antes las tres lists usaban el acceso abierto genérico y cualquiera,
 * sin sesión, podía editar o borrar cualquier animal por API. Los flujos del servidor
 * (`createAnimalReport`, semillas) usan `sudo()` y no pasan por aquí.
 *
 * Un animal publicado a nombre de un espacio de rescate (`organization`) también lo editan los
 * admins, coordinadores y voluntarios de esa organización, y lo borran sus admins y coordinadores.
 */

/** Animales que `userId` puede editar: los suyos y los de su organización (sin atajo de admin). */
export function editableAnimalFilter(userId: string, orgRoles: string[] = RESCUE_ANIMAL_EDITOR_ROLES) {
  return {
    OR: [
      { user: { id: { equals: userId } } },
      { organization: rescueOrgMemberFilter(userId, orgRoles) },
    ],
  };
}

function ownAnimalWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return editableAnimalFilter(userId);
}

function deletableAnimalWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return editableAnimalFilter(userId, RESCUE_ANIMAL_MANAGER_ROLES);
}

function ownChildWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { animal: editableAnimalFilter(userId) };
}

/** `Animal`: ver, todos; crear, con sesión; editar y borrar, el dueño, su organización o un admin. */
export const animalAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: anyone, update: ownAnimalWhere, delete: deletableAnimalWhere },
};

/**
 * ¿`userId` puede editar este animal? Para `viewerCanEdit` y las mutaciones (lee con sudo).
 * `animal` trae los ids crudos de Keystone (`userId`, `organizationId`).
 */
export async function canEditAnimalAs(
  context: KeystoneContext,
  animal: { userId?: string | null; organizationId?: string | null } | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!animal || !userId) return false;
  if (animal.userId && animal.userId === userId) return true;
  if (!animal.organizationId) return false;
  const role = await findRescueMemberRole(context, animal.organizationId, userId);
  return Boolean(role && RESCUE_ANIMAL_EDITOR_ROLES.includes(role));
}

/**
 * Publicar o mover un animal a nombre de una organización exige ser de su equipo (admin,
 * coordinador o voluntario) y que la organización esté activa (en revisión o verificada).
 */
export async function validateAnimalOrganization({
  resolvedData,
  context,
  addValidationError,
}: {
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}): Promise<void> {
  const organizationId: string | undefined = resolvedData?.organization?.connect?.id;
  if (!organizationId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const userId = getSessionUserId(context.session);
  const organization = (await context.sudo().query.RescueOrganization.findOne({
    where: { id: organizationId },
    query: "id status",
  })) as { id: string; status: string } | null;
  if (!organization) {
    addValidationError("No encontramos ese espacio de rescate.");
    return;
  }
  if (!RESCUE_ORG_ACTIVE_STATUSES.includes(organization.status)) {
    addValidationError("Ese espacio de rescate no está activo. No se puede publicar a su nombre.");
    return;
  }
  const role = userId ? await findRescueMemberRole(context, organizationId, userId) : null;
  if (!role || !RESCUE_ANIMAL_EDITOR_ROLES.includes(role)) {
    addValidationError("Solo su equipo puede publicar a nombre de este espacio de rescate.");
  }
}

/** `AnimalLog` y `AnimalMultimedia`: mismo criterio, a través del animal. */
export const animalChildAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: anyone, update: ownChildWhere, delete: ownChildWhere },
};

/** El dueño de un animal nuevo es quien lo crea (un admin sí puede asignarlo a otra persona). */
export function forceAnimalOwner(
  resolvedData: Record<string, any>,
  operation: string,
  context: KeystoneContext,
): Record<string, any> {
  if (operation !== "create" || isSudoContext(context) || isPlatformAdmin(context.session)) {
    return resolvedData;
  }
  const userId = getSessionUserId(context.session);
  return userId ? { ...resolvedData, user: { connect: { id: userId } } } : resolvedData;
}

/**
 * Crear (o mover) una bitácora o foto exige ser dueño del animal destino: el filtro de acceso
 * solo cubre update/delete, no el create.
 */
export async function validateAnimalChildOwner({
  resolvedData,
  context,
  addValidationError,
}: {
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}): Promise<void> {
  const animalId: string | undefined = resolvedData?.animal?.connect?.id;
  if (!animalId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const userId = getSessionUserId(context.session);
  const animal = (await context.sudo().query.Animal.findOne({
    where: { id: animalId },
    query: "user { id } organization { id }",
  })) as { user?: { id: string } | null; organization?: { id: string } | null } | null;
  const allowed = await canEditAnimalAs(
    context,
    animal ? { userId: animal.user?.id ?? null, organizationId: animal.organization?.id ?? null } : null,
    userId,
  );
  if (!allowed) {
    addValidationError("Solo quien atiende al animal puede agregar o mover sus fotos y actualizaciones.");
  }
}

/**
 * `AnimalComment` y `AnimalFavorite`: públicos para leer (la ficha muestra comentarios y
 * conteos); crear con sesión y a nombre propio; editar solo un admin; borrar el autor o un admin.
 */
export const animalUserRowAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: adminOnly, delete: signedIn },
  filter: { query: anyone, update: () => true, delete: ownRowWhere },
};

/**
 * `AnimalView`: se registra también sin sesión (cuenta visitas); nadie la edita y solo un admin
 * la borra. Lectura pública porque `animal_viewsCount` pasa por este acceso.
 */
export const animalViewAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: anyone, update: () => false, delete: adminOnly },
};
