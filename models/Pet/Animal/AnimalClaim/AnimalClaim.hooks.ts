import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { isSudoContext } from "../../../../utils/activity/listActivityHooks";
import { normalizeMxPhone } from "../../../../utils/pet/phone";
import { notifyClaimRequested } from "../../../../utils/notifications/animalReportAlerts";
import {
  ANIMAL_CLAIM_MESSAGE_MAX,
  ANIMAL_CLAIM_STATUS,
  MAX_ANIMAL_CLAIMS_PER_DAY,
} from "./constants";

type HookArgs = {
  resolvedData: Record<string, any>;
  operation: string;
  context: KeystoneContext;
};

/**
 * La solicitud queda a nombre de quien tiene la sesión, en revisión y con quien atendía el
 * reporte en ese momento (`previousUser`), para saber a quién se le quitó si se aprueba.
 */
export async function resolveAnimalClaimInput({ resolvedData, operation, context }: HookArgs) {
  if (operation !== "create") return resolvedData;
  const data = { ...resolvedData };
  if (!isSudoContext(context) && !isPlatformAdmin(context.session)) {
    const userId = getSessionUserId(context.session);
    if (userId) data.claimant = { connect: { id: userId } };
    data.status = ANIMAL_CLAIM_STATUS.PENDING;
  }
  const claimantId: string | undefined = data.claimant?.connect?.id;
  if (claimantId) {
    const claimant = (await context.sudo().query.User.findOne({
      where: { id: claimantId },
      query: "name lastName",
    })) as { name?: string | null; lastName?: string | null } | null;
    data.claimantName = [claimant?.name, claimant?.lastName].filter(Boolean).join(" ").trim();
  }
  const animalId: string | undefined = data.animal?.connect?.id;
  if (animalId && !data.previousUser) {
    const animal = (await context.sudo().query.Animal.findOne({
      where: { id: animalId },
      query: "user { id }",
    })) as { user?: { id: string } | null } | null;
    if (animal?.user?.id) data.previousUser = { connect: { id: animal.user.id } };
  }
  if (typeof data.message === "string") data.message = data.message.trim();
  if (typeof data.phone === "string") {
    const phone = normalizeMxPhone(data.phone);
    if (phone.ok) data.phone = phone.digits;
  }
  return data;
}

export async function validateAnimalClaimInput({
  resolvedData,
  operation,
  context,
  addValidationError,
}: HookArgs & { addValidationError: (message: string) => void }) {
  if (operation !== "create" || isSudoContext(context)) return;

  const animalId: string | undefined = resolvedData.animal?.connect?.id;
  const claimantId: string | undefined = resolvedData.claimant?.connect?.id;
  if (!animalId) return addValidationError("Elige el reporte que quieres reclamar.");
  if (!claimantId) return addValidationError("Inicia sesión para reclamar el reporte.");

  const message = String(resolvedData.message ?? "").trim();
  if (message.length < 10) {
    addValidationError("Cuéntale a quien lo reportó cómo saber que es tu mascota.");
  } else if (message.length > ANIMAL_CLAIM_MESSAGE_MAX) {
    addValidationError(`El mensaje puede tener hasta ${ANIMAL_CLAIM_MESSAGE_MAX} caracteres.`);
  }
  const phone = normalizeMxPhone(String(resolvedData.phone ?? ""));
  if (!phone.ok) addValidationError(phone.reason);

  const animal = (await context.sudo().query.Animal.findOne({
    where: { id: animalId },
    query: "id user { id } duplicateOf { id }",
  })) as { id: string; user?: { id: string } | null; duplicateOf?: { id: string } | null } | null;
  if (!animal) return addValidationError("No encontramos ese reporte.");
  if (animal.user?.id === claimantId) return addValidationError("Este reporte ya es tuyo.");
  if (animal.duplicateOf) {
    return addValidationError("Este reporte se unió a otro. Reclama el reporte principal.");
  }

  const pending = await context.sudo().query.AnimalClaim.count({
    where: {
      animal: { id: { equals: animalId } },
      claimant: { id: { equals: claimantId } },
      status: { equals: ANIMAL_CLAIM_STATUS.PENDING },
    },
  });
  if (pending > 0) {
    return addValidationError("Ya enviaste una solicitud para este reporte. Espera la respuesta.");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = await context.sudo().query.AnimalClaim.count({
    where: { claimant: { id: { equals: claimantId } }, createdAt: { gte: since } },
  });
  if (today >= MAX_ANIMAL_CLAIMS_PER_DAY) {
    addValidationError("Llegaste al máximo de solicitudes por hoy. Intenta mañana.");
  }
}

export async function animalClaimAfterOperation({
  operation,
  item,
  context,
}: {
  operation: string;
  item: any;
  context: KeystoneContext;
}) {
  if (operation !== "create" || !item?.id) return;
  void notifyClaimRequested(context, String(item.id));
}
