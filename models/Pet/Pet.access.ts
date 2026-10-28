import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
} from "../../utils/access/tenant";
import { isSudoContext } from "../../utils/activity/listActivityHooks";
import { PET_OWNER_ROLE } from "./constants";

/**
 * Cartilla: una mascota y todo lo que cuelga de ella (fotos, registros, adjuntos, recordatorios,
 * dueños) solo lo ven y cambian sus dueños (`PetOwner`). Borrar la mascota o quitar familiares es
 * del dueño principal. Un admin de plataforma ve todo. Las mutaciones de la cartilla
 * (`graphql/customs/mutations/pet/card/`) validan al dueño y luego escriben con `sudo()`.
 */

type AccessArgs = { session?: unknown };

const signedIn = ({ session }: AccessArgs) => isSignedIn(session as any);
const adminOnly = ({ session }: AccessArgs) => isPlatformAdmin(session as any);

/** Mascotas de `userId`, sin el atajo de admin (sirve también como filtro anidado). */
export function ownedPetFilter(userId: string, principalOnly = false) {
  return {
    owners: {
      some: {
        user: { id: { equals: userId } },
        ...(principalOnly ? { role: { equals: PET_OWNER_ROLE.PRINCIPAL } } : {}),
      },
    },
  };
}

function ownedPetWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? ownedPetFilter(userId) : false;
}

function principalPetWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? ownedPetFilter(userId, true) : false;
}

function ownedChildWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { pet: ownedPetFilter(userId) } : false;
}

function ownedAttachmentWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { healthRecord: { pet: ownedPetFilter(userId) } } : false;
}

/**
 * Nunca se borra la fila principal por API (solo junto con la mascota, con sudo). Una fila de
 * familiar la borra el principal de esa mascota, la propia persona (se sale) o un admin.
 */
function petOwnerDeleteWhere({ session }: AccessArgs) {
  const family = { role: { equals: PET_OWNER_ROLE.FAMILY } };
  if (isPlatformAdmin(session as any)) return family;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return {
    AND: [
      family,
      { OR: [{ pet: ownedPetFilter(userId, true) }, { user: { id: { equals: userId } } }] },
    ],
  };
}

/** `Pet`: ver y editar, sus dueños; crear, con sesión; borrar, solo el principal. */
export const petAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: ownedPetWhere, update: ownedPetWhere, delete: principalPetWhere },
};

/** `PetMultimedia`, `PetHealthRecord` y `PetReminder`: cualquier dueño de la mascota. */
export const petChildAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: ownedChildWhere, update: ownedChildWhere, delete: ownedChildWhere },
};

/** `PetHealthRecordAttachment`: a través del registro y su mascota. */
export const petHealthRecordAttachmentAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: ownedAttachmentWhere, update: ownedAttachmentWhere, delete: ownedAttachmentWhere },
};

/**
 * `PetOwner`: los dueños de una mascota ven quién más lo es. Por API solo un admin crea o edita
 * filas; el principal agrega familiares con `addPetFamilyMember`.
 */
export const petOwnerAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: adminOnly, update: adminOnly, delete: signedIn },
  filter: { query: ownedChildWhere, delete: petOwnerDeleteWhere },
};

/** Rol de `userId` en la mascota, o `null` si no es dueño. Lee con sudo. */
export async function findPetOwnerRole(
  context: KeystoneContext,
  petId: string,
  userId: string,
): Promise<string | null> {
  const rows = (await context.sudo().query.PetOwner.findMany({
    where: { pet: { id: { equals: petId } }, user: { id: { equals: userId } } },
    query: "id role",
    take: 1,
  })) as Array<{ id: string; role: string }>;
  return rows[0]?.role ?? null;
}

type ValidateArgs = {
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
};

/**
 * Crear (o mover) una foto, registro o recordatorio exige ser dueño de la mascota destino: el
 * filtro de acceso solo cubre leer, editar y borrar, no el create.
 */
export async function validatePetChildOwner({
  resolvedData,
  context,
  addValidationError,
}: ValidateArgs): Promise<void> {
  const petId: string | undefined = resolvedData?.pet?.connect?.id;
  if (!petId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const userId = getSessionUserId(context.session);
  if (!userId || !(await findPetOwnerRole(context, petId, userId))) {
    addValidationError("Solo los dueños de la mascota pueden agregar o mover datos de su cartilla.");
  }
}

/** Igual que `validatePetChildOwner`, para un adjunto: el registro destino debe ser de tu mascota. */
export async function validateHealthRecordAttachmentOwner({
  resolvedData,
  context,
  addValidationError,
}: ValidateArgs): Promise<void> {
  const recordId: string | undefined = resolvedData?.healthRecord?.connect?.id;
  if (!recordId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const userId = getSessionUserId(context.session);
  const record = (await context.sudo().query.PetHealthRecord.findOne({
    where: { id: recordId },
    query: "pet { id }",
  })) as { pet?: { id: string } | null } | null;
  const petId = record?.pet?.id;
  if (!userId || !petId || !(await findPetOwnerRole(context, petId, userId))) {
    addValidationError("Solo los dueños de la mascota pueden adjuntar archivos a su cartilla.");
  }
}
