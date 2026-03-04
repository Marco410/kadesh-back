import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  select,
  relationship,
  timestamp,
} from "@keystone-6/core/fields";
import { saasPlanAccess } from "./SaasPlan.access";
import { PLAN_FREQUENCY_OPTIONS } from "./constants";

export default list({
  access: saasPlanAccess,
  ui: {
    listView: {
      initialColumns: ["name", "cost", "frequency", "leadLimit", "companies"],
    },
  },
  fields: {
    /** Plan display name */
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Plan name (e.g. Starter, Pro, Enterprise)" },
    }),
    /** Price amount (in plan currency) */
    cost: float({
      ui: { description: "Plan cost per billing period" },
    }),
    /** Billing frequency: weekly, monthly, or annual */
    frequency: select({
      type: "string",
      options: [...PLAN_FREQUENCY_OPTIONS],
      ui: { description: "Billing frequency (weekly, monthly, annual)" },
    }),
    leadLimit: integer({
      ui: { description: "Max leads that can be synced per month for this plan" },
    }),
    companies: relationship({
      ref: "SaasCompany.plan",
      many: true,
      ui: { description: "Companies using this plan" },
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
