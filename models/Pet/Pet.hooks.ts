import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../utils/access/tenant";
import { isSudoContext } from "../../utils/activity/listActivityHooks";
import { mxToday } from "../../utils/usage/dailyUsageRollup";
import { PET_OWNER_ROLE, PET_RESCUE_STAGE, PET_STATUS } from "./constants";
import { findRescueMemberRole } from "./RescueOrganization/RescueOrganization.access";
import {
  RESCUE_ANIMAL_EDITOR_ROLES,
  RESCUE_ANIMAL_MANAGER_ROLES,
  RESCUE_ORG_ACTIVE_STATUSES,
} from "./RescueOrganization/constants";

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
  // `resolvedData` trae todas las llaves; sin `status` en el cambio no hay nada que revisar.
  if (!resolvedData || resolvedData.status === undefined) return;
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

/** Una ficha nueva de un espacio de rescate arranca «Recién llegado» con fecha de llegada de hoy. */
function resolveRescuePetInput({ operation, resolvedData }: HookArgs) {
  if (!resolvedData) return resolvedData;
  if (operation === "create" && resolvedData.organization?.connect?.id) {
    if (!resolvedData.stage) resolvedData.stage = PET_RESCUE_STAGE.INTAKE;
    // `calendarDay` ya llega aquí como Date (medianoche UTC del día).
    if (!resolvedData.intakeDate) resolvedData.intakeDate = new Date(`${mxToday()}T00:00:00.000Z`);
  }
  return resolvedData;
}

/**
 * Reglas de la ficha interna (las mutaciones y un admin de plataforma no pasan por aquí):
 * - Crear con `organization` exige ser admin, coordinación o voluntariado de un espacio activo.
 * - Etapa, fecha de llegada y hogar temporal solo existen en fichas de un espacio. Etapa y fecha
 *   las cambia el mismo equipo; el hogar temporal, admin y coordinación, y debe ser del equipo.
 */
async function validateRescuePet({ operation, item, resolvedData, context, addValidationError }: HookArgs) {
  if (!resolvedData || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const fail = (message: string) => addValidationError?.(message);
  const userId = getSessionUserId(context.session);
  const organizationId: string | null =
    (operation === "create" ? resolvedData.organization?.connect?.id : item?.organizationId) ?? null;

  if (!organizationId) {
    if (resolvedData.stage || resolvedData.intakeDate || resolvedData.fosterMember?.connect) {
      fail("La etapa, la fecha de llegada y el hogar temporal son solo para fichas de un espacio de rescate.");
    }
    return;
  }

  const role = userId ? await findRescueMemberRole(context, organizationId, userId) : null;
  const isEditor = Boolean(role && RESCUE_ANIMAL_EDITOR_ROLES.includes(role));

  if (operation === "create") {
    const org = (await context.sudo().query.RescueOrganization.findOne({
      where: { id: organizationId },
      query: "status",
    })) as { status?: string } | null;
    if (!isEditor) {
      fail("Solo admin, coordinación o voluntariado del espacio pueden crear fichas a su nombre.");
    } else if (!org?.status || !RESCUE_ORG_ACTIVE_STATUSES.includes(org.status)) {
      fail("Este espacio de rescate no está activo.");
    }
  } else if ((resolvedData.stage !== undefined || resolvedData.intakeDate !== undefined) && !isEditor) {
    // `resolvedData` trae todas las llaves; las que no vienen en el cambio valen `undefined`.
    fail("La etapa y la fecha de llegada las cambia el equipo del espacio.");
  }

  if (resolvedData.fosterMember !== undefined) {
    if (!role || !RESCUE_ANIMAL_MANAGER_ROLES.includes(role)) {
      fail("El hogar temporal lo asignan admin y coordinación del espacio.");
      return;
    }
    const memberId: string | undefined = resolvedData.fosterMember?.connect?.id;
    if (memberId) {
      const member = (await context.sudo().query.RescueOrganizationMember.findOne({
        where: { id: memberId },
        query: "organization { id }",
      })) as { organization?: { id: string } | null } | null;
      if (member?.organization?.id !== organizationId) fail("Elige a alguien del equipo del espacio.");
    }
  }
}

async function validatePetInput(args: HookArgs) {
  validatePetStatus(args);
  await validateRescuePet(args);
}

/**
 * Quien registra la mascota queda como su dueño principal. Una ficha de un espacio de rescate no
 * tiene dueños: el principal llega al completar la adopción.
 */
async function createPrincipalOwner({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id || item.organizationId) return;
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
  resolveInput: resolveRescuePetInput,
  validateInput: validatePetInput,
  afterOperation: createPrincipalOwner,
  beforeOperation: deletePetOwnData,
};
