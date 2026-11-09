import { randomInt } from "crypto";
import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { PET_OWNER_ROLE, PET_STATUS } from "../../../../../models/Pet/constants";
import { findPetOwnerRole } from "../../../../../models/Pet/Pet.access";
import {
  PET_TRANSFER_ALPHABET,
  PET_TRANSFER_CODE_LENGTH,
  PET_TRANSFER_MESSAGE_MAX,
  PET_TRANSFER_STATUS,
  PET_TRANSFER_TTL_DAYS,
} from "../../../../../models/Pet/PetTransfer/constants";
import {
  findRescueMemberRole,
  rescueStaffIds,
} from "../../../../../models/Pet/RescueOrganization/RescueOrganization.access";
import { RESCUE_ANIMAL_MANAGER_ROLES } from "../../../../../models/Pet/RescueOrganization/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { logActivity } from "../../../../../utils/activity/logActivity";
import { notify } from "../../../../../utils/notifications/notify";
import { settleApplicationsAfterAdoption } from "../../../../../utils/pet/adoptionApplications";
import { petListUrl, rescuePetsListUrl } from "../../../../../utils/pet/petCard";
import { cancelPendingTransfers, loadTransferablePet, transferPetToOwner } from "../../../../../utils/pet/petTransfer";

/**
 * Traspasar una mascota (su cartilla completa: datos, fotos, registros y recordatorios) a otra
 * cuenta con un código. Sirve para una familia que da a su mascota y para un espacio de rescate que
 * entrega un animal en adopción.
 *
 * - `createPetTransferCode`: lo genera el dueño principal o, si es ficha de un espacio, admin o
 *   coordinación. Vale 7 días; generar uno nuevo cancela el anterior.
 * - `previewPetTransferCode`: quien lo recibe ve qué mascota es y quién se la da, antes de aceptar.
 * - `redeemPetTransferCode`: la mascota pasa a su cuenta como dueño principal. La familia anterior
 *   deja de verla; si era ficha de un espacio, sale del espacio y su reporte queda «Adoptado».
 * - `cancelPetTransferCode`: quien lo generó (o quien puede dar la mascota) lo anula.
 *
 * Ver y canjear tienen un tope por hora contra quien quiera adivinar códigos (`pet_transfer_redeem_user`).
 */

const typeDefs = `
  type PetTransferCodeResult {
    success: Boolean!
    message: String!
    transfer: PetTransfer
  }

  type PetTransferPreview {
    success: Boolean!
    message: String!
    petName: String
    "Valor de AnimalType.name (dog, cat…)"
    species: String
    breed: String
    photoUrl: String
    "Quien da la mascota: el espacio de rescate o el nombre de la persona"
    fromName: String
    fromOrganization: Boolean
    transferMessage: String
    expiresAt: String
  }

  type PetTransferRedeemResult {
    success: Boolean!
    message: String!
    petId: ID
  }
`;

const definition = `
  createPetTransferCode(petId: ID!, message: String): PetTransferCodeResult!
  cancelPetTransferCode(transferId: ID!): PetTransferCodeResult!
  previewPetTransferCode(code: String!): PetTransferPreview!
  redeemPetTransferCode(code: String!): PetTransferRedeemResult!
`;

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof GraphQLError ? error.message : fallback;
}

/** «7kq2 m9xa», «7KQ2-M9XA» → «7KQ2M9XA». */
export function normalizeTransferCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < PET_TRANSFER_CODE_LENGTH; i += 1) {
    code += PET_TRANSFER_ALPHABET[randomInt(PET_TRANSFER_ALPHABET.length)];
  }
  return code;
}

type Giver = {
  userId: string;
  pet: { id: string; name: string; status: string; organizationId: string | null };
  organization: { id: string; name: string } | null;
};

/** Quien llama puede dar la mascota: principal, o admin/coordinación del espacio dueño de la ficha. */
async function requireGiver(context: KeystoneContext, petId: string): Promise<Giver> {
  const userId = getSessionUserId(context.session);
  if (!userId) throw new GraphQLError("Inicia sesión para continuar.");
  const pet = await prismaOf(context).pet.findUnique({
    where: { id: petId },
    select: { id: true, name: true, status: true, organizationId: true, organization: { select: { id: true, name: true } } },
  });
  if (!pet || pet instanceof Error) throw new GraphQLError("No encontramos esta mascota.");
  const admin = isPlatformAdmin(context.session);
  if (pet.organizationId) {
    const role = await findRescueMemberRole(context, pet.organizationId, userId);
    if (!admin && !(role && RESCUE_ANIMAL_MANAGER_ROLES.includes(role))) {
      throw new GraphQLError("Solo admin y coordinación del espacio pueden entregar a este animal.");
    }
  } else if (!admin && (await findPetOwnerRole(context, pet.id, userId)) !== PET_OWNER_ROLE.PRINCIPAL) {
    throw new GraphQLError("Solo el dueño principal puede traspasar a esta mascota.");
  }
  return {
    userId,
    pet: { id: pet.id, name: pet.name, status: pet.status, organizationId: pet.organizationId },
    organization: pet.organization ?? null,
  };
}

type TransferRow = {
  id: string;
  code: string;
  status: string;
  expiresAt: Date;
  message: string | null;
  petId: string | null;
  createdById: string | null;
  fromOrganizationId: string | null;
};

/**
 * El código y su mascota, si `userId` puede recibirla. Si no, el motivo en palabras de la persona.
 * Revalida que quien lo generó todavía pueda dar la mascota.
 */
async function loadRedeemable(
  context: KeystoneContext,
  rawCode: string,
  userId: string,
): Promise<{ ok: true; transfer: TransferRow; petName: string } | { ok: false; message: string }> {
  const code = normalizeTransferCode(rawCode);
  if (code.length !== PET_TRANSFER_CODE_LENGTH) {
    return { ok: false, message: `El código tiene ${PET_TRANSFER_CODE_LENGTH} letras y números, como 7KQ2-M9XA.` };
  }
  const prisma = prismaOf(context);
  const transfer = (await prisma.petTransfer.findUnique({ where: { code } })) as TransferRow | null;
  if (!transfer || !transfer.petId) return { ok: false, message: "Ese código no existe. Revisa que esté bien escrito." };
  if (transfer.status === PET_TRANSFER_STATUS.REDEEMED) return { ok: false, message: "Ese código ya se usó." };
  if (transfer.status === PET_TRANSFER_STATUS.CANCELLED) {
    return { ok: false, message: "Ese código se canceló. Pide uno nuevo a quien te da la mascota." };
  }
  if (new Date(transfer.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: "Ese código venció. Pide uno nuevo a quien te da la mascota." };
  }
  const pet = await prisma.pet.findUnique({
    where: { id: transfer.petId },
    select: { id: true, name: true, status: true, organizationId: true },
  });
  if (!pet || pet instanceof Error || pet.status !== PET_STATUS.ACTIVE) {
    return { ok: false, message: "Esa mascota ya no se puede traspasar." };
  }
  if (transfer.createdById === userId) {
    return { ok: false, message: `Es tu propio código: compártelo con quien recibirá a ${pet.name}.` };
  }
  // Quien lo generó debe seguir pudiendo darla (la ficha sigue en el espacio, o sigue siendo el principal).
  const stillGiver = transfer.fromOrganizationId
    ? pet.organizationId === transfer.fromOrganizationId
    : !pet.organizationId &&
      Boolean(transfer.createdById) &&
      (await findPetOwnerRole(context, pet.id, transfer.createdById!)) === PET_OWNER_ROLE.PRINCIPAL;
  if (!stillGiver) return { ok: false, message: "Ese código ya no es válido. Pide uno nuevo." };
  if ((await findPetOwnerRole(context, pet.id, userId)) === PET_OWNER_ROLE.PRINCIPAL) {
    return { ok: false, message: `${pet.name} ya está en tu cuenta.` };
  }
  return { ok: true, transfer, petName: pet.name };
}

function displayName(user: { name?: string | null; lastName?: string | null } | null | undefined): string {
  return [user?.name, user?.lastName].filter(Boolean).join(" ").trim();
}

const resolver = {
  createPetTransferCode: async (
    _root: unknown,
    { petId, message }: { petId: string; message?: string | null },
    context: KeystoneContext,
  ) => {
    const fail = (text: string) => ({ success: false, message: text, transfer: null });
    try {
      const { userId, pet, organization } = await requireGiver(context, petId);
      if (pet.status !== PET_STATUS.ACTIVE) {
        return fail(
          pet.status === PET_STATUS.LOST
            ? "Primero cierra su reporte de perdida con «Ya regresó a casa»."
            : "Solo se traspasa una mascota activa.",
        );
      }
      const note = (message ?? "").trim();
      if (note.length > PET_TRANSFER_MESSAGE_MAX) {
        return fail(`El mensaje puede tener hasta ${PET_TRANSFER_MESSAGE_MAX} caracteres.`);
      }

      await cancelPendingTransfers(context, pet.id);
      const prisma = prismaOf(context);
      let code = "";
      for (let attempt = 0; attempt < 5 && !code; attempt += 1) {
        const candidate = newCode();
        const taken = await prisma.petTransfer.findUnique({ where: { code: candidate }, select: { id: true } });
        if (!taken) code = candidate;
      }
      if (!code) return fail("No pudimos generar el código. Intenta de nuevo.");

      const created = await prisma.petTransfer.create({
        data: {
          petId: pet.id,
          code,
          status: PET_TRANSFER_STATUS.PENDING,
          expiresAt: new Date(Date.now() + PET_TRANSFER_TTL_DAYS * 24 * 60 * 60 * 1000),
          message: note,
          fromOrganizationId: organization?.id ?? null,
          createdById: userId,
        },
        select: { id: true },
      });
      if (created instanceof Error) throw created;

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_TRANSFER_CODE_CREATED,
        summary: `Generó un código para traspasar a "${pet.name.slice(0, 60)}"${organization ? ` (${organization.name.slice(0, 80)})` : ""}`,
        entityType: "Pet",
        entityId: pet.id,
        metadata: { transferId: created.id, organizationId: organization?.id ?? null },
      });
      return {
        success: true,
        message: `Código listo. Vale ${PET_TRANSFER_TTL_DAYS} días.`,
        transfer: await context.db.PetTransfer.findOne({ where: { id: created.id } }),
      };
    } catch (error) {
      console.error("[createPetTransferCode]", error);
      return fail(errorMessage(error, "No pudimos generar el código. Intenta de nuevo."));
    }
  },

  cancelPetTransferCode: async (_root: unknown, { transferId }: { transferId: string }, context: KeystoneContext) => {
    const fail = (text: string) => ({ success: false, message: text, transfer: null });
    try {
      const prisma = prismaOf(context);
      const transfer = (await prisma.petTransfer.findUnique({ where: { id: transferId } })) as TransferRow | null;
      if (!transfer?.petId) return fail("No encontramos ese código.");
      const userId = getSessionUserId(context.session);
      if (transfer.createdById !== userId) await requireGiver(context, transfer.petId);
      if (transfer.status !== PET_TRANSFER_STATUS.PENDING) return fail("Ese código ya no está activo.");
      const updated = await prisma.petTransfer.update({
        where: { id: transfer.id },
        data: { status: PET_TRANSFER_STATUS.CANCELLED },
      });
      if (updated instanceof Error) throw updated;
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_TRANSFER_CODE_CANCELLED,
        summary: "Canceló un código de traspaso de mascota",
        entityType: "Pet",
        entityId: transfer.petId,
        metadata: { transferId: transfer.id },
      });
      return {
        success: true,
        message: "Cancelamos el código. Ya no sirve.",
        transfer: await context.db.PetTransfer.findOne({ where: { id: transfer.id } }),
      };
    } catch (error) {
      console.error("[cancelPetTransferCode]", error);
      return fail(errorMessage(error, "No pudimos cancelar el código. Intenta de nuevo."));
    }
  },

  previewPetTransferCode: async (_root: unknown, { code }: { code: string }, context: KeystoneContext) => {
    const empty = {
      petName: null,
      species: null,
      breed: null,
      photoUrl: null,
      fromName: null,
      fromOrganization: null,
      transferMessage: null,
      expiresAt: null,
    };
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return { success: false, message: "Inicia sesión para recibir a la mascota.", ...empty };
      const found = await loadRedeemable(context, code, userId);
      if (!found.ok) return { success: false, message: found.message, ...empty };
      const { transfer } = found;
      const sudo = context.sudo();
      const [pet, giver] = await Promise.all([
        sudo.query.Pet.findOne({
          where: { id: transfer.petId! },
          query: "name animal_type { name } animal_breed { breed } multimedia(orderBy: [{ order: asc }], take: 1) { image { url } }",
        }) as Promise<{
          name: string;
          animal_type?: { name?: string | null } | null;
          animal_breed?: { breed?: string | null } | null;
          multimedia?: Array<{ image?: { url?: string | null } | null }>;
        } | null>,
        transfer.fromOrganizationId
          ? (sudo.query.RescueOrganization.findOne({
              where: { id: transfer.fromOrganizationId },
              query: "name",
            }) as Promise<{ name?: string | null } | null>)
          : transfer.createdById
            ? (sudo.query.User.findOne({ where: { id: transfer.createdById }, query: "name lastName" }) as Promise<{
                name?: string | null;
                lastName?: string | null;
              } | null>)
            : Promise.resolve(null),
      ]);
      return {
        success: true,
        message: "",
        petName: pet?.name ?? found.petName,
        species: pet?.animal_type?.name ?? null,
        breed: pet?.animal_breed?.breed ?? null,
        photoUrl: pet?.multimedia?.[0]?.image?.url ?? null,
        fromName: transfer.fromOrganizationId
          ? (giver as { name?: string | null } | null)?.name ?? "Un espacio de rescate"
          : displayName(giver as { name?: string | null; lastName?: string | null } | null) || "Una persona",
        fromOrganization: Boolean(transfer.fromOrganizationId),
        transferMessage: transfer.message || null,
        expiresAt: new Date(transfer.expiresAt).toISOString(),
      };
    } catch (error) {
      console.error("[previewPetTransferCode]", error);
      return { success: false, message: "No pudimos revisar el código. Intenta de nuevo.", ...empty };
    }
  },

  redeemPetTransferCode: async (_root: unknown, { code }: { code: string }, context: KeystoneContext) => {
    const fail = (text: string) => ({ success: false, message: text, petId: null });
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return fail("Inicia sesión para recibir a la mascota.");
      const found = await loadRedeemable(context, code, userId);
      if (!found.ok) return fail(found.message);
      const { transfer } = found;
      const prisma = prismaOf(context);

      // Se aparta antes de mover nada: si dos personas lo canjean a la vez, solo una gana.
      const claimed = await prisma.petTransfer.updateMany({
        where: { id: transfer.id, status: PET_TRANSFER_STATUS.PENDING },
        data: { status: PET_TRANSFER_STATUS.REDEEMED, redeemedById: userId, redeemedAt: new Date() },
      });
      if (claimed instanceof Error) throw claimed;
      if (claimed.count !== 1) return fail("Ese código ya se usó.");

      const pet = await loadTransferablePet(context, transfer.petId!);
      const organization = transfer.fromOrganizationId
        ? ((await context.sudo().query.RescueOrganization.findOne({
            where: { id: transfer.fromOrganizationId },
            query: "id name",
          })) as { id: string; name: string } | null)
        : null;
      try {
        if (!pet) throw new Error("La mascota ya no existe");
        await transferPetToOwner(context, pet, userId, {
          reportNote: organization ? `Adoptado con ${organization.name} en KADESH.` : undefined,
        });
      } catch (error) {
        // No se movió: el código vuelve a quedar disponible.
        await prisma.petTransfer.updateMany({
          where: { id: transfer.id },
          data: { status: PET_TRANSFER_STATUS.PENDING, redeemedById: null, redeemedAt: null },
        });
        throw error;
      }
      await cancelPendingTransfers(context, pet.id);
      if (pet.publicReportId) {
        const report = (await context.sudo().query.Animal.findOne({
          where: { id: pet.publicReportId },
          query: "id name slug",
        })) as { id: string; name?: string | null; slug?: string | null } | null;
        if (report) await settleApplicationsAfterAdoption(context, { animal: report, adopterId: userId, petId: pet.id });
      }

      const recipient = (await context.sudo().query.User.findOne({
        where: { id: userId },
        query: "name lastName",
      })) as { name?: string | null; lastName?: string | null } | null;
      const recipientName = displayName(recipient) || "Alguien";
      const audience = organization
        ? await rescueStaffIds(context, organization.id, RESCUE_ANIMAL_MANAGER_ROLES)
        : transfer.createdById
          ? [transfer.createdById]
          : [];
      if (audience.length) {
        void notify(context, {
          audience,
          product: "pet",
          type: NOTIFICATION_TYPE.PET_TRANSFER_REDEEMED,
          title: `${pet.name} ya está con su nueva familia`,
          body: `${recipientName} recibió su cartilla con el código.`,
          entityType: "Pet",
          entityId: pet.id,
          // La mascota ya no es suya: el enlace lleva a la lista, no a la cartilla.
          url: organization ? rescuePetsListUrl(organization.id) : petListUrl(),
          metadata: { organizationId: organization?.id ?? null },
        });
      }
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_TRANSFER_REDEEMED,
        summary: `Recibió a "${pet.name.slice(0, 60)}" con un código${organization ? ` de ${organization.name.slice(0, 80)}` : ""}`,
        entityType: "Pet",
        entityId: pet.id,
        metadata: { transferId: transfer.id, organizationId: organization?.id ?? null },
      });
      return { success: true, message: `${pet.name} ya está en tu cartilla.`, petId: pet.id };
    } catch (error) {
      console.error("[redeemPetTransferCode]", error);
      return fail(errorMessage(error, "No pudimos recibir a la mascota. Intenta de nuevo."));
    }
  },
};

export default { typeDefs, definition, resolver };
