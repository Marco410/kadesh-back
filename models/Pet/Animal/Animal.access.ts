import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../utils/access/tenant";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";

/**
 * Animales de Kadesh Pet: la ficha es pública (cualquiera la ve), pero solo el dueño o un admin
 * de plataforma la cambia. Antes las tres lists usaban el acceso abierto genérico y cualquiera,
 * sin sesión, podía editar o borrar cualquier animal por API. Los flujos del servidor
 * (`createAnimalReport`, semillas) usan `sudo()` y no pasan por aquí.
 */

const anyone = () => true;
const signedIn = ({ session }: { session?: unknown }) => isSignedIn(session as any);

function ownAnimalWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { user: { id: { equals: userId } } };
}

function ownChildWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { animal: { user: { id: { equals: userId } } } };
}

/** `Animal`: ver, todos; crear, con sesión; editar y borrar, el dueño o un admin. */
export const animalAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: anyone, update: ownAnimalWhere, delete: ownAnimalWhere },
};

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
    query: "user { id }",
  })) as { user?: { id: string } | null } | null;
  if (!userId || animal?.user?.id !== userId) {
    addValidationError("Solo el dueño del animal puede agregar o mover sus fotos y actualizaciones.");
  }
}
