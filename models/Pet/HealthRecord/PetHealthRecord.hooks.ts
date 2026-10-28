import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../utils/access/tenant";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";
import { validatePetChildOwner } from "../Pet.access";
import { PET_REMINDER_STATUS, petHealthRecordTypeLabel } from "../constants";

/** `calendarDay` llega como "AAAA-MM-DD" o como Date (fila de Prisma). */
export function toYmd(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

type HookArgs = {
  operation: string;
  item?: any;
  originalItem?: any;
  resolvedData?: Record<string, any>;
  context: KeystoneContext;
  addValidationError?: (message: string) => void;
};

/** El registro queda a nombre de quien lo crea. Un admin puede asignar a otra persona. */
function resolveCreatedBy({ operation, resolvedData, context }: HookArgs) {
  const data = { ...resolvedData };
  if (operation !== "create" || isSudoContext(context)) return data;
  if (isPlatformAdmin(context.session) && data.createdBy) return data;
  const userId = getSessionUserId(context.session);
  if (userId) data.createdBy = { connect: { id: userId } };
  return data;
}

async function validateHealthRecord(args: HookArgs) {
  const { operation, item, resolvedData = {}, addValidationError } = args;
  if (operation === "create" && !resolvedData.pet?.connect?.id) {
    addValidationError?.("Elige la mascota de este registro.");
  }
  await validatePetChildOwner({
    resolvedData,
    context: args.context,
    addValidationError: addValidationError ?? (() => {}),
  });
  const applied = toYmd(resolvedData.appliedDate ?? item?.appliedDate);
  const next = toYmd("nextDueDate" in resolvedData ? resolvedData.nextDueDate : item?.nextDueDate);
  if (applied && next && next < applied) {
    addValidationError?.("La próxima fecha no puede ser anterior a la fecha de aplicación.");
  }
}

function reminderTitle(item: any): string {
  return `${petHealthRecordTypeLabel(item?.type)}: ${String(item?.name ?? "").trim()}`;
}

/**
 * Un registro con `nextDueDate` tiene un recordatorio automático (1:1, `PetReminder.healthRecord`):
 * se crea al poner la fecha, se actualiza si cambia (y vuelve a `pending` para avisar de la nueva
 * fecha) y se cancela si se quita mientras seguía pendiente.
 */
async function syncReminderForHealthRecord({ operation, item, originalItem, context }: HookArgs) {
  if ((operation !== "create" && operation !== "update") || !item?.id) return;
  const due = toYmd(item.nextDueDate);
  if (operation === "update") {
    const changed =
      due !== toYmd(originalItem?.nextDueDate) ||
      item.type !== originalItem?.type ||
      item.name !== originalItem?.name ||
      item.petId !== originalItem?.petId;
    if (!changed) return;
  }

  try {
    const sudo = context.sudo();
    const [reminder] = (await sudo.query.PetReminder.findMany({
      where: { healthRecord: { id: { equals: item.id } } },
      query: "id status dueDate title pet { id }",
      take: 1,
    })) as Array<{ id: string; status: string; dueDate: string | null; title: string; pet?: { id: string } | null }>;
    const title = reminderTitle(item);

    if (!due) {
      if (reminder?.status === PET_REMINDER_STATUS.PENDING) {
        await sudo.query.PetReminder.updateOne({
          where: { id: reminder.id },
          data: { status: PET_REMINDER_STATUS.CANCELLED },
        });
      }
      return;
    }

    if (!reminder) {
      if (!item.petId) return;
      await sudo.query.PetReminder.createOne({
        data: {
          pet: { connect: { id: item.petId } },
          healthRecord: { connect: { id: item.id } },
          title,
          dueDate: due,
        },
        query: "id",
      });
      return;
    }

    const data: Record<string, unknown> = {};
    if (reminder.title !== title) data.title = title;
    if (item.petId && reminder.pet?.id !== item.petId) data.pet = { connect: { id: item.petId } };
    if (toYmd(reminder.dueDate) !== due) {
      data.dueDate = due;
      data.status = PET_REMINDER_STATUS.PENDING;
      data.sentAt = null;
    }
    if (Object.keys(data).length > 0) {
      await sudo.query.PetReminder.updateOne({ where: { id: reminder.id }, data });
    }
  } catch (error) {
    console.error("[petHealthRecord] No se pudo sincronizar el recordatorio:", item.id, error);
  }
}

/** El recordatorio automático se va con su registro. */
async function deleteRecordReminder({ operation, item, context }: HookArgs) {
  if (operation !== "delete" || !item?.id) return;
  const sudo = context.sudo();
  const reminders = (await sudo.query.PetReminder.findMany({
    where: { healthRecord: { id: { equals: item.id } } },
    query: "id",
  })) as Array<{ id: string }>;
  if (reminders.length > 0) {
    await sudo.db.PetReminder.deleteMany({ where: reminders.map((row) => ({ id: row.id })) });
  }
}

export const petHealthRecordHooks = {
  resolveInput: resolveCreatedBy,
  validateInput: validateHealthRecord,
  afterOperation: syncReminderForHealthRecord,
  beforeOperation: deleteRecordReminder,
};
