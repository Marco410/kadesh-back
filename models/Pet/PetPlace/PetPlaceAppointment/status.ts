export const PET_PLACE_APPOINTMENT_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
} as const;

export type PetPlaceAppointmentStatus =
  (typeof PET_PLACE_APPOINTMENT_STATUS)[keyof typeof PET_PLACE_APPOINTMENT_STATUS];

export const PET_PLACE_APPOINTMENT_STATUS_OPTIONS = [
  { label: "Pendiente", value: PET_PLACE_APPOINTMENT_STATUS.PENDING },
  { label: "Confirmada", value: PET_PLACE_APPOINTMENT_STATUS.CONFIRMED },
  { label: "Cancelada", value: PET_PLACE_APPOINTMENT_STATUS.CANCELLED },
  { label: "Completada", value: PET_PLACE_APPOINTMENT_STATUS.COMPLETED },
  { label: "No se presentó", value: PET_PLACE_APPOINTMENT_STATUS.NO_SHOW },
];
