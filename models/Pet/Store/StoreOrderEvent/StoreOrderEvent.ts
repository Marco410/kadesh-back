import { list } from "@keystone-6/core";
import { checkbox, json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

/**
 * Timeline of an order: what happened, when and who did it. Append-only, written by
 * `addStoreOrderEvent` in `utils/store/orders.ts`.
 *
 * `actor` empty = the system (Stripe webhook, cron). `isPublic` rows are the ones the shopper sees
 * in their order; the rest are internal.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200, omit: { create: true, update: true, delete: true } },
  db: {
    extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, "\n  @@index([orderId, createdAt])\n}"),
  },
  ui: {
    listView: { initialColumns: ["order", "type", "actor", "message", "createdAt"] },
  },
  fields: {
    order: relationship({ ref: "StoreOrder.events", many: false }),
    type: text({ validation: { isRequired: true } }),
    fromStatus: text(),
    toStatus: text(),
    actor: relationship({ ref: "User", many: false }),
    message: text(),
    isPublic: checkbox({ defaultValue: false }),
    metadata: json(),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
