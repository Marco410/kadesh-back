import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { pawReadOnlyAccess } from "./Paws.access";

/**
 * One row per person with their paw points ("huellitas"). Created on the first award.
 *
 * Only `utils/pet/paws.ts` writes here (raw SQL, atomic with the ledger row). Never edit `balance`
 * or `lifetimeEarned` by hand: use `adminAdjustPaws`, which also writes the ledger.
 * The level is not stored: `pawLevelFor(lifetimeEarned)`.
 */
export default list({
  access: pawReadOnlyAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  db: {
    // One account per person; the engine upserts on this constraint.
    extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, "\n  @@unique([userId])\n}"),
  },
  ui: {
    listView: { initialColumns: ["user", "balance", "lifetimeEarned", "streakWeeks", "updatedAt"] },
  },
  fields: {
    user: relationship({ ref: "User", many: false }),
    /** Spendable points. Goes down with reversals and (phase 2) with redemptions. */
    balance: integer({ defaultValue: 0, db: { isNullable: false } }),
    /** Drives the level and the all-time ranking. Goes down with reversals, never with spending. */
    lifetimeEarned: integer({ defaultValue: 0, db: { isNullable: false }, isIndexed: true }),
    streakWeeks: integer({ defaultValue: 0, db: { isNullable: false } }),
    bestStreakWeeks: integer({ defaultValue: 0, db: { isNullable: false } }),
    /** Monday (YYYY-MM-DD, Mexico City) of the last week with a qualifying action. Empty = never. */
    streakWeekStart: text(),
    /** The person asked not to appear in the public ranking. */
    rankingHidden: checkbox({ defaultValue: false }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
});
