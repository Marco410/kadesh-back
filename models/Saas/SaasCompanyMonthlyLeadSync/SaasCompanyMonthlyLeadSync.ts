import { list } from "@keystone-6/core";
import { integer, relationship, timestamp } from "@keystone-6/core/fields";
import { saasCompanyMonthlyLeadSyncAccess } from "./SaasCompanyMonthlyLeadSync.access";

export default list({
  access: saasCompanyMonthlyLeadSyncAccess,
  ui: {
    listView: {
      initialColumns: ["company", "year", "month", "syncedCount"],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.monthlyLeadSyncRecords",
      many: false,
    }),
    year: integer({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Year of the sync period" },
    }),
    month: integer({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Month of the sync period (1-12)" },
    }),
    /** Number of leads synced in this month for this company (used vs plan leadLimit) */
    syncedCount: integer({
      defaultValue: 0,
      ui: { description: "Number of leads synced this month (for quota tracking)" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } },
    }),
  },
});
