export const PET_PLACE_CLAIM_STATUS = {
  UNCLAIMED: "unclaimed",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

export type PetPlaceClaimStatus =
  (typeof PET_PLACE_CLAIM_STATUS)[keyof typeof PET_PLACE_CLAIM_STATUS];

export const PET_PLACE_CLAIM_STATUS_OPTIONS = [
  { label: "Sin reclamar", value: PET_PLACE_CLAIM_STATUS.UNCLAIMED },
  { label: "En revisión", value: PET_PLACE_CLAIM_STATUS.PENDING },
  { label: "Verificada", value: PET_PLACE_CLAIM_STATUS.VERIFIED },
  { label: "Rechazada", value: PET_PLACE_CLAIM_STATUS.REJECTED },
];

export const PET_PLACE_CLAIM_ROLE = {
  OWNER: "owner",
  MANAGER: "manager",
  VET: "vet",
} as const;

export type PetPlaceClaimRole =
  (typeof PET_PLACE_CLAIM_ROLE)[keyof typeof PET_PLACE_CLAIM_ROLE];

export const PET_PLACE_CLAIM_ROLE_OPTIONS = [
  { label: "Propietario", value: PET_PLACE_CLAIM_ROLE.OWNER },
  { label: "Encargado", value: PET_PLACE_CLAIM_ROLE.MANAGER },
  { label: "Veterinario", value: PET_PLACE_CLAIM_ROLE.VET },
];
