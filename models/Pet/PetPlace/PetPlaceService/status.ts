export const PET_PLACE_SERVICE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type PetPlaceServiceStatus =
  (typeof PET_PLACE_SERVICE_STATUS)[keyof typeof PET_PLACE_SERVICE_STATUS];

export const PET_PLACE_SERVICE_STATUS_OPTIONS = [
  { label: "Pendiente", value: PET_PLACE_SERVICE_STATUS.PENDING },
  { label: "Aprobado", value: PET_PLACE_SERVICE_STATUS.APPROVED },
  { label: "Rechazado", value: PET_PLACE_SERVICE_STATUS.REJECTED },
];
