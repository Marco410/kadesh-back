/** Subscription status (aligned with Stripe subscription status) */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  UNPAID: "unpaid",
  TRIALING: "trialing",
} as const;

export const SUBSCRIPTION_STATUS_OPTIONS = [
  { label: "Active", value: SUBSCRIPTION_STATUS.ACTIVE },
  { label: "Past due", value: SUBSCRIPTION_STATUS.PAST_DUE },
  { label: "Cancelled", value: SUBSCRIPTION_STATUS.CANCELLED },
  { label: "Unpaid", value: SUBSCRIPTION_STATUS.UNPAID },
  { label: "Trialing", value: SUBSCRIPTION_STATUS.TRIALING },
] as const;
