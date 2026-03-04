import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  calendarDay,
  relationship,
  json,
} from "@keystone-6/core/fields";
import { saasCompanyAccess } from "./SaasCompany.access";

export default list({
  access: saasCompanyAccess,
  ui: {
    listView: {
      initialColumns: [
        "name",
        "plan",
        "allowedGooglePlaceCategories",
        "subscriptionStartedAt",
        "users",
      ],
    },
  },
  fields: {
    /** Company / organization name */
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Company or organization name" },
    }),
    /** Users belonging to this company (1 company : N users) */
    users: relationship({
      ref: "User.company",
      many: true,
      ui: { description: "Users belonging to this company" },
    }),
    /** Subscription plan for this company */
    plan: relationship({
      ref: "SaasPlan.companies",
      many: false,
      ui: { description: "Subscription plan (defines cost, frequency, lead limit)" },
    }),
    /** Date when the company started its subscription */
    subscriptionStartedAt: calendarDay({
      ui: { description: "Date when the subscription started" },
    }),
    /** Monthly lead sync usage records (count of leads synced per month) */
    monthlyLeadSyncRecords: relationship({
      ref: "SaasCompanyMonthlyLeadSync.company",
      many: true,
      ui: { description: "Per-month lead sync usage (for quota enforcement)" },
    }),
    allowedGooglePlaceCategories: json({
      ui: {
        description:
          "Allowed categories for lead sync. JSON array of category values from GOOGLE_PLACE_CATEGORIES (e.g. [\"restaurantes\", \"cafeterías\"]). Empty or null = all allowed.",
      },
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
