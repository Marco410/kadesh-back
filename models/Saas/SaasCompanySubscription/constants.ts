/** Subscription status (aligned with Stripe subscription status) */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  UNPAID: "unpaid",
  TRIALING: "trialing",
} as const;

export const SUBSCRIPTION_STATUS_OPTIONS = [
  { label: "Activa", value: SUBSCRIPTION_STATUS.ACTIVE },
  { label: "Vencida", value: SUBSCRIPTION_STATUS.PAST_DUE },
  { label: "Cancelada", value: SUBSCRIPTION_STATUS.CANCELLED },
  { label: "No pagada", value: SUBSCRIPTION_STATUS.UNPAID },
  { label: "En prueba", value: SUBSCRIPTION_STATUS.TRIALING },
] as const;
