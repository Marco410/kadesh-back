import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
} from "../../utils/access/tenant";
import { isSudoContext } from "../../utils/activity/listActivityHooks";
import { PET_OWNER_ROLE } from "./constants";
import { rescueOrgMemberFilter } from "./RescueOrganization/RescueOrganization.access";
import { RESCUE_ANIMAL_EDITOR_ROLES, RESCUE_ANIMAL_MANAGER_ROLES } from "./RescueOrganization/constants";

/**
 * Cartilla: una mascota y todo lo que cuelga de ella (fotos, registros, adjuntos, recordatorios,
 * dueños) solo lo ven y cambian sus dueños (`PetOwner`). Borrar la mascota o quitar familiares es
 * del dueño principal. Un admin de plataforma ve todo. Las mutaciones de la cartilla
 * (`graphql/customs/mutations/pet/card/`) validan al dueño y luego escriben con `sudo()`.
 *
 * Ficha interna de un espacio de rescate (`Pet.organization`): no tiene dueños hasta que se adopta.
 * La ven y editan admin, coordinación y voluntariado del espacio; quien es hogar temporal, solo
 * las que tiene asignadas (`fosterMember`). Borrarla es de admin y coordinación.
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

/**
 * Mascotas que `userId` puede ver y editar: las suyas (dueño o familia), las fichas de un espacio
 * donde es admin, coordinación o voluntariado, y las que tiene en su hogar temporal.
 */
export function editablePetFilter(userId: string) {
  return {
    OR: [
      ownedPetFilter(userId),
      { organization: rescueOrgMemberFilter(userId, RESCUE_ANIMAL_EDITOR_ROLES) },
      { fosterMember: { user: { id: { equals: userId } } } },
    ],
  };
}

function editablePetWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? editablePetFilter(userId) : false;
}

/** Borrar: el dueño principal, o admin y coordinación del espacio dueño de la ficha. */
function deletablePetWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return {
    OR: [
      ownedPetFilter(userId, true),
      { organization: rescueOrgMemberFilter(userId, RESCUE_ANIMAL_MANAGER_ROLES) },
    ],
  };
}

function ownedChildWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { pet: ownedPetFilter(userId) } : false;
}

function editableChildWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { pet: editablePetFilter(userId) } : false;
}

function editableAttachmentWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { healthRecord: { pet: editablePetFilter(userId) } } : false;
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

/**
 * `Pet`: ver y editar, sus dueños o el equipo del espacio (ver `editablePetFilter`); crear, con
 * sesión; borrar, el principal o admin y coordinación del espacio.
 */
export const petAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: editablePetWhere, update: editablePetWhere, delete: deletablePetWhere },
};

/** `PetMultimedia`, `PetHealthRecord` y `PetReminder`: quien puede editar la mascota. */
export const petChildAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: editableChildWhere, update: editableChildWhere, delete: editableChildWhere },
};

/** `PetHealthRecordAttachment`: a través del registro y su mascota. */
export const petHealthRecordAttachmentAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: signedIn, delete: signedIn },
  filter: { query: editableAttachmentWhere, update: editableAttachmentWhere, delete: editableAttachmentWhere },
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

export type PetAccessRow = {
  id: string;
  organizationId?: string | null;
  fosterMemberId?: string | null;
};

/**
 * Con qué rol entra `userId` a la mascota: `principal` o `family` si es dueño; si es ficha de un
 * espacio, su rol en el equipo (`admin`, `coordinator`, `volunteer`, o el que tenga si es el hogar
 * temporal asignado). `null` si no puede verla. Lee con sudo.
 */
export async function findPetAccessRole(
  context: KeystoneContext,
  pet: PetAccessRow,
  userId: string,
): Promise<string | null> {
  const ownerRole = await findPetOwnerRole(context, pet.id, userId);
  if (ownerRole) return ownerRole;
  if (!pet.organizationId) return null;
  const [member] = (await context.sudo().query.RescueOrganizationMember.findMany({
    where: { organization: { id: { equals: pet.organizationId } }, user: { id: { equals: userId } } },
    query: "id role",
    take: 1,
  })) as Array<{ id: string; role: string }>;
  if (!member) return null;
  if (RESCUE_ANIMAL_EDITOR_ROLES.includes(member.role)) return member.role;
  return pet.fosterMemberId && pet.fosterMemberId === member.id ? member.role : null;
}

/** `findPetAccessRole` a partir del id (lee la ficha con sudo). */
export async function findPetAccessRoleById(
  context: KeystoneContext,
  petId: string,
  userId: string,
): Promise<string | null> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { id: true, organizationId: true, fosterMemberId: true },
  });
  if (!pet || pet instanceof Error) return null;
  return findPetAccessRole(context, pet as PetAccessRow, userId);
}

type ValidateArgs = {
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
};

/**
 * Crear (o mover) una foto, registro o recordatorio exige poder editar la mascota destino (dueño
 * o equipo del espacio): el filtro de acceso solo cubre leer, editar y borrar, no el create.
 */
export async function validatePetChildOwner({
  resolvedData,
  context,
  addValidationError,
}: ValidateArgs): Promise<void> {
  const petId: string | undefined = resolvedData?.pet?.connect?.id;
  if (!petId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const userId = getSessionUserId(context.session);
  if (!userId || !(await findPetAccessRoleById(context, petId, userId))) {
    addValidationError("Solo quien cuida a la mascota puede agregar o mover datos de su cartilla.");
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
  if (!userId || !petId || !(await findPetAccessRoleById(context, petId, userId))) {
    addValidationError("Solo quien cuida a la mascota puede adjuntar archivos a su cartilla.");
  }
}
