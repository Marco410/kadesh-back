export const COMPANY_CREDIT_LEDGER_TYPE = {
  GRANT_PLAN: "GRANT_PLAN",
  GRANT_PURCHASE: "GRANT_PURCHASE",
  CONSUME_SYNC: "CONSUME_SYNC",
  ADJUST: "ADJUST",
} as const;

export type SaasCompanyCreditLedgerType =
  (typeof COMPANY_CREDIT_LEDGER_TYPE)[keyof typeof COMPANY_CREDIT_LEDGER_TYPE];

export const COMPANY_CREDIT_LEDGER_TYPE_OPTIONS = [
  { label: "Grant plan", value: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN },
  { label: "Grant purchase", value: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE },
  { label: "Consume sync", value: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC },
  { label: "Adjust", value: COMPANY_CREDIT_LEDGER_TYPE.ADJUST },
];
