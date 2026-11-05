import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import { adminOnly, anyone, ownRowWhere, signedIn } from "../../../utils/access/presets";
import { getSessionUserId, isPlatformAdmin } from "../../../utils/access/tenant";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";
import { PET_EVENT_LIMITS, PET_EVENT_STATUS } from "./constants";

type AccessArgs = { session?: unknown };

/**
 * Lo que una persona puede ver de `PetEvent`: los publicados, los cancelados que llegaron a
 * publicarse (la ficha avisa que se canceló) y los propios en cualquier estado. El admin ve todos.
 */
export function visiblePetEventWhere({ session }: AccessArgs): boolean | Record<string, unknown> {
  if (isPlatformAdmin(session as any)) return true;
  const visible: Record<string, unknown>[] = [
    { status: { equals: PET_EVENT_STATUS.APPROVED } },
    { status: { equals: PET_EVENT_STATUS.CANCELLED }, NOT: [{ approvedAt: { equals: null } }] },
  ];
  const userId = getSessionUserId(session as any);
  if (userId) visible.push({ user: { id: { equals: userId } } });
  return { OR: visible };
}

/** Lo mismo, visto desde una fila hija (fecha, foto). */
function visibleChildWhere(args: AccessArgs) {
  const where = visiblePetEventWhere(args);
  return where === true ? true : { event: where };
}

function ownChildWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { event: { user: { id: { equals: userId } } } };
}

/**
 * `PetEvent`: la escritura pasa por las mutaciones `submitPetEvent`, `updateMyPetEvent`,
 * `cancelPetEvent` y `reviewPetEvent` (sudo), que aplican las reglas de revisión. El CRUD directo
 * queda para admins (Keystone admin UI).
 */
export const petEventAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: visiblePetEventWhere },
};

/** `PetEventSession`: visible con su evento; la escriben las mutaciones del evento. */
export const petEventSessionAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: visibleChildWhere },
};

/** `PetEventMultimedia`: la sube y la borra quien organiza el evento (o un admin). */
export const petEventMultimediaAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: visibleChildWhere, update: ownChildWhere, delete: ownChildWhere },
};

/** `PetEventInterest`: cada quien ve los suyos; se escriben con `setPetEventInterest`. */
export const petEventInterestAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: ownRowWhere },
};

/**
 * Subir (o mover) una foto exige ser quien organiza el evento destino, y hay un tope de fotos.
 * El filtro de acceso solo cubre update/delete, no el create.
 */
export async function validatePetEventMultimedia({
  operation,
  resolvedData,
  context,
  addValidationError,
}: {
  operation: string;
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}): Promise<void> {
  if (operation === "delete") return;
  const eventId: string | undefined = resolvedData?.event?.connect?.id;
  if (!eventId) {
    if (operation === "create") addValidationError("La foto debe pertenecer a un evento.");
    return;
  }
  if (isSudoContext(context)) return;
  const event = (await context.sudo().query.PetEvent.findOne({
    where: { id: eventId },
    query: "id user { id } multimediaCount",
  })) as { id: string; user?: { id: string } | null; multimediaCount?: number } | null;
  if (!event) {
    addValidationError("No encontramos el evento.");
    return;
  }
  if (!isPlatformAdmin(context.session)) {
    const userId = getSessionUserId(context.session);
    if (!userId || event.user?.id !== userId) {
      addValidationError("Solo quien organiza el evento puede agregar sus fotos.");
      return;
    }
  }
  if (operation === "create" && (event.multimediaCount ?? 0) >= PET_EVENT_LIMITS.MAX_PHOTOS) {
    addValidationError(`Un evento puede tener hasta ${PET_EVENT_LIMITS.MAX_PHOTOS} fotos.`);
  }
}
