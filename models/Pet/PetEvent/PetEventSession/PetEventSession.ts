import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { petEventSessionAccess } from "../PetEvent.access";
import { recomputePetEventDates } from "../PetEvent.rules";

/**
 * Una fecha de un evento (inicio y fin). Un evento de varios días puede ser una sola fecha (hasta
 * 7 días) o varias; uno recurrente ("cada sábado") son varias. Al cambiar, se recalculan
 * `firstStartsAt` / `lastEndsAt` del evento.
 */
export default list({
  access: petEventSessionAccess,
  ui: {
    listView: { initialColumns: ["event", "startsAt", "endsAt"] },
  },
  hooks: {
    validateInput: ({ resolvedData, item, addValidationError }: any) => {
      const startsAt = new Date(resolvedData.startsAt ?? item?.startsAt);
      const endsAt = new Date(resolvedData.endsAt ?? item?.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return;
      if (endsAt.getTime() <= startsAt.getTime()) addValidationError("La fecha debe terminar después de empezar.");
    },
    afterOperation: async ({ item, originalItem, context }: any) => {
      const ids = new Set([item?.eventId, originalItem?.eventId].filter(Boolean) as string[]);
      for (const id of ids) await recomputePetEventDates(context, id);
    },
  },
  fields: {
    event: relationship({ ref: "PetEvent.sessions" }),
    startsAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    endsAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
  },
});
