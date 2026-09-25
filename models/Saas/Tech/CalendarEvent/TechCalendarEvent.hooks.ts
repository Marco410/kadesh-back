import {
  getSessionCompanyId,
  getSessionUserId,
} from "../../../../utils/access/tenant";
import {
  deleteEventFromGoogle,
  pushEventToGoogle,
} from "../../../../utils/googleCalendar/sync";

export const techCalendarEventHooks = {
  /** Al crear a mano, el evento queda a nombre del usuario y de su empresa. */
  resolveInput: async ({ operation, resolvedData, context }: any) => {
    if (operation !== "create") return resolvedData;
    const userId = getSessionUserId(context.session);
    const companyId = getSessionCompanyId(context.session);
    if (!resolvedData.createdBy && userId) {
      resolvedData.createdBy = { connect: { id: userId } };
    }
    if (!resolvedData.company && companyId) {
      resolvedData.company = { connect: { id: companyId } };
    }
    return resolvedData;
  },

  validateInput: async ({
    operation,
    item,
    resolvedData,
    addValidationError,
  }: any) => {
    if (operation === "delete") return;
    const startAt = resolvedData.startAt ?? item?.startAt;
    const endAt = resolvedData.endAt !== undefined ? resolvedData.endAt : item?.endAt;
    if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      addValidationError("La fecha de fin no puede ser anterior a la de inicio");
    }
    if (operation === "create" && !resolvedData.company) {
      addValidationError("El evento debe pertenecer a una empresa");
    }
    if (operation === "create" && !resolvedData.createdBy) {
      addValidationError("El evento debe tener un usuario dueño");
    }
  },

  /** Antes de borrar hay que borrar las copias en Google: después ya no hay links que seguir. */
  beforeOperation: async ({ operation, item, context }: any) => {
    if (operation !== "delete" || !item?.id) return;
    try {
      await deleteEventFromGoogle(context, item.id);
    } catch (err) {
      console.error("Error borrando evento en Google Calendar:", err);
    }
  },

  afterOperation: async ({ operation, item, context }: any) => {
    if (operation === "delete" || !item?.id) return;
    try {
      await pushEventToGoogle(context, item.id);
    } catch (err) {
      console.error("Error enviando evento a Google Calendar:", err);
    }
  },
};
