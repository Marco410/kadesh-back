import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../utils/access/presets";
import { bumpDonationsDataVersion } from "../../../utils/donations/config";
import { DONATION_SOURCE_OPTIONS, DONATION_STATUS, DONATION_STATUS_OPTIONS } from "./constants";

/**
 * A «Dame una patita» donation. Created by `startDonation` (pending) and settled by the Stripe
 * webhook (`webhooks/stripeDonation.ts`). Admin only in the generated API: the public sees the
 * wall and the ranking through `donationWall` / `donorRanking`, never the email nor the amount.
 *
 * Admins may edit it from the Admin UI to hide a message (`messageHidden`).
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, delete: true } },
  ui: {
    label: "Donaciones (patitas)",
    listView: {
      initialColumns: ["donorName", "unitCount", "status", "message", "hideFromWall", "messageHidden", "source", "paidAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  // An admin hiding a message (or fixing a row) shows up on the public wall right away.
  hooks: { afterOperation: () => bumpDonationsDataVersion() },
  db: {
    extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, "\n  @@index([status, paidAt])\n}"),
  },
  fields: {
    unitCount: integer({ validation: { isRequired: true, min: 1 }, ui: { description: "Patitas (1 = $25 MXN)." } }),
    amountCents: integer({ validation: { isRequired: true } }),
    currency: text({ defaultValue: "mxn" }),
    donorName: text({ ui: { description: "Como lo escribió la persona. En público sale nombre + inicial." } }),
    donorEmail: text({ ui: { description: "Privado: solo para el correo de agradecimiento." } }),
    /** `user:<id>` or `email:<sha256>`: groups the donations of one person in the ranking. */
    donorKey: text({ isIndexed: true }),
    user: relationship({ ref: "User", many: false }),
    message: text({ ui: { displayMode: "textarea" } }),
    isAnonymous: checkbox({ defaultValue: false }),
    hideFromWall: checkbox({
      defaultValue: false,
      ui: { description: "Quien donó pidió no salir en el muro ni en el top. Sí cuenta en el total; el mensaje solo lo lee el equipo." },
    }),
    messageHidden: checkbox({ defaultValue: false, ui: { description: "Oculta el mensaje en el muro (la patita sigue contando)." } }),
    status: select({
      type: "string",
      options: DONATION_STATUS_OPTIONS,
      defaultValue: DONATION_STATUS.PENDING,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    checkoutKey: text({ isIndexed: "unique", db: { isNullable: true } }),
    stripePaymentIntentId: text({ isIndexed: "unique", db: { isNullable: true } }),
    stripeChargeId: text({ db: { isNullable: true } }),
    source: select({ type: "string", options: DONATION_SOURCE_OPTIONS, defaultValue: "other" }),
    sourceRef: text(),
    errorMessage: text(),
    paidAt: timestamp({ isIndexed: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
