import { list } from "@keystone-6/core";
import { calendarDay, integer, relationship, select } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { AD_PLACEMENT_OPTIONS } from "../constants";

const readOnly = { ui: { createView: { fieldMode: "hidden" as const }, itemView: { fieldMode: "read" as const } } };

/**
 * Impressions and clicks of an ad: one row per ad, day (Mexico City) and placement. Written only by
 * `recordAdEvents` with one `INSERT … ON CONFLICT` per batch; read by the Operaciones report.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 500 },
  db: {
    extendPrismaSchema: (schema) =>
      schema.replace(/\n\}\s*$/, "\n  @@unique([adId, day, placement])\n  @@index([day])\n}"),
  },
  ui: {
    isHidden: true,
    listView: { initialColumns: ["ad", "day", "placement", "impressions", "clicks"] },
  },
  fields: {
    ad: relationship({ ref: "Ad", ...readOnly }),
    day: calendarDay({ validation: { isRequired: true }, ...readOnly }),
    placement: select({ type: "string", options: AD_PLACEMENT_OPTIONS, validation: { isRequired: true }, ...readOnly }),
    impressions: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    clicks: integer({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
  },
});
