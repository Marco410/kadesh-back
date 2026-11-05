import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { petEventInterestAccess } from "../PetEvent.access";
import { PET_EVENT_INTEREST_KIND, PET_EVENT_INTEREST_KIND_OPTIONS } from "../constants";

/**
 * «Me interesa» / «Asistiré» de una persona en un evento: una fila por persona y evento (`key`).
 * Se escribe con `setPetEventInterest`. Los conteos públicos salen de `PetEvent.interestedCount` y
 * `goingCount`. `lastRemindedSessionId` evita mandar dos veces el recordatorio de la misma fecha.
 */
export default list({
  access: petEventInterestAccess,
  ui: {
    listView: { initialColumns: ["event", "user", "kind", "createdAt"] },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "<userId>:<eventId>", itemView: { fieldMode: "read" } },
    }),
    event: relationship({ ref: "PetEvent.interests" }),
    user: relationship({ ref: "User" }),
    kind: select({
      type: "string",
      options: PET_EVENT_INTEREST_KIND_OPTIONS,
      defaultValue: PET_EVENT_INTEREST_KIND.INTERESTED,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    lastRemindedSessionId: text({ db: { isNullable: true }, ui: { itemView: { fieldMode: "read" } } }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
