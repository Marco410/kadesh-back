/** Billing frequency for SaaS plans and one-time credit packages */
export const PLAN_FREQUENCY = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  ANNUAL: "annual",
  ONCE: "once",
} as const;

export type PlanFrequencyValue = (typeof PLAN_FREQUENCY)[keyof typeof PLAN_FREQUENCY];

export const PLAN_FREQUENCY_OPTIONS = [
  { label: "Weekly", value: PLAN_FREQUENCY.WEEKLY },
  { label: "Monthly", value: PLAN_FREQUENCY.MONTHLY },
  { label: "Annual", value: PLAN_FREQUENCY.ANNUAL },
  { label: "One-time", value: PLAN_FREQUENCY.ONCE },
] as const;
