import { list } from "@keystone-6/core";
import {
  calendarDay,
  float,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export default list({
  access: () => true,
  ui: {
    listView: {
      initialColumns: [
        "referrer",
        "referredUser",
        "company",
        "subscription",
        "plan",
        "type",
        "status",
        "amount",
        "currency",
        "notes",
      ],
    },
  },
  fields: {
    referrer: relationship({
      ref: "User",
      ui: { description: "User who receives the commission (referrer)" },
    }),
    referredUser: relationship({
      ref: "User",
      ui: { description: "User who was referred and purchased the plan" },
    }),
    company: relationship({
      ref: "SaasCompany",
      ui: { description: "Company associated with the subscription" },
    }),
    subscription: relationship({
      ref: "SaasCompanySubscription",
      ui: { description: "Subscription that originated this commission" },
    }),
    plan: relationship({
      ref: "SaasPlan",
      ui: { description: "Plan associated with this commission" },
    }),
    type: select({
      type: "string",
      options: [
        { label: "Upfront", value: "UPFRONT" },
        { label: "Recurring", value: "RECURRING" },
      ],
      ui: { displayMode: "segmented-control" },
    }),
    percentage: float({
      ui: { description: "Percentage applied to plan cost to compute amount" },
    }),
    amount: float({
      ui: { description: "Commission amount (snapshot at creation time)" },
    }),
    currency: text({
      defaultValue: "mxn",
      ui: { description: "Currency code, e.g. mxn, usd" },
    }),
    periodIndex: float({
      ui: {
        description:
          "0 for upfront, 1..N for recurring periods (e.g. months after signup)",
      },
    }),
    periodStart: calendarDay({
      db: { isNullable: true },
      ui: { description: "Start date of the commission period (if applicable)" },
    }),
    periodEnd: calendarDay({
      db: { isNullable: true },
      ui: { description: "End date of the commission period (if applicable)" },
    }),
    status: select({
      type: "string",
      options: [
        { label: "Pending", value: "PENDING" },
        { label: "Earned", value: "EARNED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Paid", value: "PAID" },
      ],
      defaultValue: "PENDING",
      ui: { displayMode: "segmented-control" },
    }),
    notes: text({
      db: { isNullable: true },
      ui: { description: "Optional notes about this commission (e.g. cancellation reason)" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});

