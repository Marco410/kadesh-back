import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { PAW_ACTION_OPTIONS, PAW_KIND, PAW_KIND_OPTIONS } from "./constants";
import { pawReadOnlyAccess } from "./Paws.access";

/**
 * Paw points ledger. Append-only: a mistake is fixed with a new row (reversal or admin adjust),
 * never by editing or deleting one.
 *
 * `sourceKey` names what was rewarded (`report:<animalId>`, `sighting:<userId>:<animalId>`…).
 * While the rows of a source key add up to more than zero it cannot be awarded again.
 * `key` is `<sourceKey>#<n>` and unique, so two requests racing for the same award cannot both win.
 */
export default list({
  access: pawReadOnlyAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  db: {
    // History of one person, newest first, and their daily caps.
    extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, "\n  @@index([userId, createdAt])\n}"),
  },
  ui: {
    listView: { initialColumns: ["user", "action", "kind", "amount", "balanceAfter", "createdAt"] },
  },
  fields: {
    user: relationship({ ref: "User", many: false }),
    action: select({ type: "string", options: PAW_ACTION_OPTIONS, validation: { isRequired: true } }),
    kind: select({
      type: "string",
      options: PAW_KIND_OPTIONS,
      defaultValue: PAW_KIND.EARN,
      validation: { isRequired: true },
    }),
    /** Signed: positive earns, negative reverses or spends. */
    amount: integer({ validation: { isRequired: true } }),
    /** Balance right after this row. Empty on backfilled rows. */
    balanceAfter: integer(),
    key: text({ isIndexed: "unique", validation: { isRequired: true } }),
    sourceKey: text({ isIndexed: true, validation: { isRequired: true } }),
    referenceType: text(),
    referenceId: text(),
    metadata: json(),
    createdAt: timestamp({ defaultValue: { kind: "now" }, isIndexed: true }),
  },
});
