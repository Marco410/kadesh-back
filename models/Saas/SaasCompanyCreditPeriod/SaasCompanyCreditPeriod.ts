import { list } from "@keystone-6/core";
import { integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { companyCreditPeriodAccess } from "./SaasCompanyCreditPeriod.access";

export default list({
  access: companyCreditPeriodAccess,
  ui: {
    listView: {
      initialColumns: [
        "company",
        "year",
        "month",
        "planAllowance",
        "bonusAllowance",
        "used",
        "periodKey",
      ],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.creditPeriods",
      many: false,
      ui: { description: "Company that owns this credit period" },
    }),
    subscription: relationship({
      ref: "SaasCompanySubscription.creditPeriods",
      many: false,
      ui: { description: "Active subscription when this period was created" },
    }),
    periodKey: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: {
        description: "Unique key: companyId:year:month",
      },
    }),
    year: integer({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Year of the credit period" },
    }),
    month: integer({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Month of the credit period (1-12)" },
    }),
    planAllowance: integer({
      defaultValue: 0,
      ui: { description: "Monthly lead allowance from the active plan" },
    }),
    bonusAllowance: integer({
      defaultValue: 0,
      ui: {
        description:
          "Extra purchased credits added to the monthly allowance for this period",
      },
    }),
    used: integer({
      defaultValue: 0,
      ui: { description: "Credits consumed in this period" },
    }),
    ledgerEntries: relationship({
      ref: "SaasCompanyCreditLedger.period",
      many: true,
      ui: { description: "Ledger movements for this period" },
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
