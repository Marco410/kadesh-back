import type { KeystoneContext } from "@keystone-6/core/types";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";
import { validatePetChildOwner } from "../Pet.access";
import { toYmd } from "../HealthRecord/PetHealthRecord.hooks";
import { PET_REMINDER_MAX_DAYS_BEFORE, PET_REMINDER_STATUS } from "../constants";

type HookArgs = {
  operation: string;
  item?: any;
  resolvedData?: Record<string, any>;
  context: KeystoneContext;
  addValidationError?: (message: string) => void;
};

/** Una fecha nueva es un aviso nuevo: vuelve a `pending` salvo que también se mande el status. */
function resetWhenDueDateChanges({ operation, item, resolvedData = {} }: HookArgs) {
  const data = { ...resolvedData };
  if (operation !== "update" || !("dueDate" in data) || "status" in data) return data;
  if (toYmd(data.dueDate) !== toYmd(item?.dueDate)) {
    data.status = PET_REMINDER_STATUS.PENDING;
    data.sentAt = null;
  }
  return data;
}

async function validateReminder(args: HookArgs) {
  const { operation, item, resolvedData = {}, context } = args;
  const addValidationError = args.addValidationError ?? (() => {});
  if (operation === "create" && !resolvedData.pet?.connect?.id) {
    addValidationError("Elige la mascota de este recordatorio.");
  }
  await validatePetChildOwner({ resolvedData, context, addValidationError });

  if ("channels" in resolvedData && (!Array.isArray(resolvedData.channels) || resolvedData.channels.length === 0)) {
    addValidationError("Elige al menos un canal para el recordatorio.");
  }
  if ("notifyDaysBefore" in resolvedData) {
    const days = Number(resolvedData.notifyDaysBefore);
    if (!Number.isInteger(days) || days < 0 || days > PET_REMINDER_MAX_DAYS_BEFORE) {
      addValidationError(`Los días de aviso van de 0 a ${PET_REMINDER_MAX_DAYS_BEFORE}.`);
    }
  }

  // Un recordatorio ligado a un registro debe ser de la misma mascota.
  const recordId: string | undefined = resolvedData.healthRecord?.connect?.id ?? item?.healthRecordId ?? undefined;
  const petId: string | undefined = resolvedData.pet?.connect?.id ?? item?.petId ?? undefined;
  if (!recordId || !petId || isSudoContext(context)) return;
  const record = (await context.sudo().query.PetHealthRecord.findOne({
    where: { id: recordId },
    query: "pet { id }",
  })) as { pet?: { id: string } | null } | null;
  if (record?.pet?.id !== petId) {
    addValidationError("El registro de la cartilla es de otra mascota.");
  }
}

export const petReminderHooks = {
  resolveInput: resetWhenDueDateChanges,
  validateInput: validateReminder,
};
