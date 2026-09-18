export const COMPANY_CREDIT_LEDGER_TYPE = {
  GRANT_PLAN: "GRANT_PLAN",
  GRANT_PURCHASE: "GRANT_PURCHASE",
  GRANT_ADMIN: "GRANT_ADMIN",
  CONSUME_SYNC: "CONSUME_SYNC",
  CONSUME_AI: "CONSUME_AI",
  ADJUST: "ADJUST",
} as const;

export type SaasCompanyCreditLedgerType =
  (typeof COMPANY_CREDIT_LEDGER_TYPE)[keyof typeof COMPANY_CREDIT_LEDGER_TYPE];

export const COMPANY_CREDIT_LEDGER_REFERENCE_TYPE = {
  SUBSCRIPTION: "subscription",
  PAYMENT: "payment",
  COMPANY: "company",
  ADMIN: "admin",
  SYNC: "sync",
  AI: "ai",
} as const;

export const COMPANY_CREDIT_LEDGER_TYPE_OPTIONS = [
  { label: "Grant plan", value: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN },
  { label: "Grant purchase", value: COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE },
  { label: "Grant admin", value: COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN },
  { label: "Consume sync", value: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_SYNC },
  { label: "Consume AI", value: COMPANY_CREDIT_LEDGER_TYPE.CONSUME_AI },
  { label: "Adjust", value: COMPANY_CREDIT_LEDGER_TYPE.ADJUST },
];
