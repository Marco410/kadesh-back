export const ANIMAL_CLAIM_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type AnimalClaimStatus = (typeof ANIMAL_CLAIM_STATUS)[keyof typeof ANIMAL_CLAIM_STATUS];

export const ANIMAL_CLAIM_STATUS_OPTIONS = [
  { label: "En revisión", value: ANIMAL_CLAIM_STATUS.PENDING },
  { label: "Aprobada", value: ANIMAL_CLAIM_STATUS.APPROVED },
  { label: "Rechazada", value: ANIMAL_CLAIM_STATUS.REJECTED },
  { label: "Cancelada", value: ANIMAL_CLAIM_STATUS.CANCELLED },
];

/** Solicitudes por persona en 24 h, para que nadie reclame reportes en masa. */
export const MAX_ANIMAL_CLAIMS_PER_DAY = 3;
export const ANIMAL_CLAIM_MESSAGE_MAX = 500;
