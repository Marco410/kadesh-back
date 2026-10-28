import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../utils/access/tenant";
import { isSudoContext } from "../../utils/activity/listActivityHooks";
import { PET_OWNER_ROLE, PET_STATUS } from "./constants";

type HookArgs = {
  operation: string;
  item?: any;
  resolvedData?: Record<string, any>;
  context: KeystoneContext;
  addValidationError?: (message: string) => void;
};

/**
 * `lost` va amarrado a un reporte (`lostReport`): solo `markPetAsLost` lo pone y solo
 * `markPetAsFound` lo quita, para que la mascota y el reporte no se desfasen.
 */
function validatePetStatus({ operation, item, resolvedData, context, addValidationError }: HookArgs) {
  if (!resolvedData || !("status" in resolvedData)) return;
  if (isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const next = resolvedData.status;
  const current = operation === "update" ? item?.status : null;
  if (next === current) return;
  if (next === PET_STATUS.LOST) {
    addValidationError?.("Para reportar a tu mascota como perdida usa \"Marcar como perdida\".");
  } else if (current === PET_STATUS.LOST) {
    addValidationError?.("Para cerrar el reporte usa \"Ya regresó a casa\".");
  }
}

/** Quien registra la mascota queda como su dueño principal. */
async function createPrincipalOwner({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id) return;
  const userId = getSessionUserId(context.session);
  if (!userId) return;
  try {
    const owners = await context.sudo().query.PetOwner.count({
      where: { pet: { id: { equals: item.id } } },
    });
    if (owners > 0) return;
    await context.sudo().query.PetOwner.createOne({
      data: {
        pet: { connect: { id: item.id } },
        user: { connect: { id: userId } },
        role: PET_OWNER_ROLE.PRINCIPAL,
      },
      query: "id",
    });
  } catch (error) {
    console.error("[pet] No se pudo crear el dueño principal:", item.id, error);
  }
}

async function deleteByIds(
  context: KeystoneContext,
  listKey: "PetReminder" | "PetHealthRecordAttachment" | "PetHealthRecord" | "PetOwner" | "PetMultimedia",
  where: Record<string, unknown>,
) {
  const rows = (await context.sudo().query[listKey].findMany({ where, query: "id" })) as Array<{
    id: string;
  }>;
  if (rows.length === 0) return;
  // `db` (no prisma) para que Keystone también borre las imágenes de R2.
  await context.sudo().db[listKey].deleteMany({ where: rows.map((row) => ({ id: row.id })) });
}

/**
 * Al borrar la mascota se van sus datos propios (dueños, fotos, cartilla, recordatorios). Los
 * reportes (`Animal.pet`) y las citas (`PetPlaceAppointment.pet`) no se borran: la base deja la
 * relación en null (ON DELETE SET NULL).
 */
async function deletePetOwnData({ operation, item, context }: HookArgs) {
  if (operation !== "delete" || !item?.id) return;
  const pet = { pet: { id: { equals: item.id } } };
  await deleteByIds(context, "PetReminder", pet);
  await deleteByIds(context, "PetHealthRecordAttachment", { healthRecord: pet });
  await deleteByIds(context, "PetHealthRecord", pet);
  await deleteByIds(context, "PetMultimedia", pet);
  await deleteByIds(context, "PetOwner", pet);
}

export const petHooks = {
  validateInput: validatePetStatus,
  afterOperation: createPrincipalOwner,
  beforeOperation: deletePetOwnData,
};
