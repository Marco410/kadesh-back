import { list } from "@keystone-6/core";
import {
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { companyCreditLedgerAccess } from "./SaasCompanyCreditLedger.access";
import { COMPANY_CREDIT_LEDGER_TYPE_OPTIONS } from "./constants";

export default list({
  access: companyCreditLedgerAccess,
  ui: {
    listView: {
      initialColumns: [
        "company",
        "type",
        "amount",
        "balanceAfter",
        "referenceType",
        "referenceId",
        "createdAt",
      ],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.creditLedgerEntries",
      many: false,
      ui: { description: "Company this ledger entry belongs to" },
    }),
    period: relationship({
      ref: "SaasCompanyCreditPeriod.ledgerEntries",
      many: false,
      ui: { description: "Credit period this entry affects" },
    }),
    type: select({
      type: "string",
      options: [...COMPANY_CREDIT_LEDGER_TYPE_OPTIONS],
      validation: { isRequired: true },
      ui: { description: "Type of credit movement" },
    }),
    amount: integer({
      validation: { isRequired: true },
      ui: {
        description: "Signed amount: positive = grant, negative = consume",
      },
    }),
    balanceAfter: integer({
      ui: { description: "Remaining credits after this movement" },
    }),
    referenceType: text({
      db: { isNullable: true },
      ui: {
        description: "Reference entity type (subscription, payment, syncLog)",
      },
    }),
    referenceId: text({
      db: { isNullable: true },
      ui: { description: "Reference entity ID" },
    }),
    notes: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Optional notes" },
    }),
    metadata: json({
      ui: { description: "Optional extra context for this movement" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
