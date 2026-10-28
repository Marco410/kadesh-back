/**
 * Cartilla digital de la mascota (`Pet`, `PetOwner`, `PetHealthRecord`, `PetReminder`).
 * Valores en inglés y etiqueta en español, igual que `ANIMAL_SEX_OPTIONS`.
 */

export const PET_STATUS = {
  ACTIVE: "active",
  LOST: "lost",
  DECEASED: "deceased",
  TRANSFERRED: "transferred",
} as const;

export const PET_STATUS_OPTIONS = [
  { label: "Activa", value: PET_STATUS.ACTIVE },
  { label: "Perdida", value: PET_STATUS.LOST },
  { label: "Fallecida", value: PET_STATUS.DECEASED },
  { label: "Transferida", value: PET_STATUS.TRANSFERRED },
];

export const PET_STERILIZED_OPTIONS = [
  { label: "Sí", value: "yes" },
  { label: "No", value: "no" },
  { label: "Desconocido", value: "unknown" },
];

export const PET_OWNER_ROLE = {
  PRINCIPAL: "principal",
  FAMILY: "family",
} as const;

export const PET_OWNER_ROLE_OPTIONS = [
  { label: "Principal", value: PET_OWNER_ROLE.PRINCIPAL },
  { label: "Familiar", value: PET_OWNER_ROLE.FAMILY },
];

export const PET_HEALTH_RECORD_TYPE_OPTIONS = [
  { label: "Vacuna", value: "vaccine" },
  { label: "Desparasitación interna", value: "internal_deworming" },
  { label: "Desparasitación externa", value: "external_deworming" },
  { label: "Consulta", value: "consultation" },
  { label: "Cirugía", value: "surgery" },
  { label: "Medicamento", value: "medication" },
  { label: "Otro", value: "other" },
];

export function petHealthRecordTypeLabel(value: string | null | undefined): string {
  return PET_HEALTH_RECORD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Registro";
}

export const PET_REMINDER_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const PET_REMINDER_STATUS_OPTIONS = [
  { label: "Pendiente", value: PET_REMINDER_STATUS.PENDING },
  { label: "Enviado", value: PET_REMINDER_STATUS.SENT },
  { label: "Completado", value: PET_REMINDER_STATUS.COMPLETED },
  { label: "Cancelado", value: PET_REMINDER_STATUS.CANCELLED },
];

export const PET_REMINDER_CHANNEL = {
  PUSH: "push",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
} as const;

export type PetReminderChannel = (typeof PET_REMINDER_CHANNEL)[keyof typeof PET_REMINDER_CHANNEL];

export const PET_REMINDER_CHANNEL_OPTIONS = [
  { label: "Push", value: PET_REMINDER_CHANNEL.PUSH },
  { label: "WhatsApp", value: PET_REMINDER_CHANNEL.WHATSAPP },
  { label: "Correo", value: PET_REMINDER_CHANNEL.EMAIL },
];

/** Canales de un recordatorio nuevo, también del que se crea solo desde un registro. */
export const PET_REMINDER_DEFAULT_CHANNELS: PetReminderChannel[] = [
  PET_REMINDER_CHANNEL.PUSH,
  PET_REMINDER_CHANNEL.EMAIL,
];

export const PET_REMINDER_DEFAULT_DAYS_BEFORE = 3;
export const PET_REMINDER_MAX_DAYS_BEFORE = 60;
