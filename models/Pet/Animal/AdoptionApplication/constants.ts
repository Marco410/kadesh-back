/**
 * Solicitudes de adopción: alguien pide adoptar un animal «En adopción». La revisa quien lo
 * publicó (o el equipo de su espacio de rescate) y, al completarla, la cartilla pasa al adoptante.
 * Ver graphql/customs/mutations/pet/adoptionApplications.ts.
 */

export const ADOPTION_APPLICATION_STATUS = {
  SUBMITTED: "submitted",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  COMPLETED: "completed",
  /** El animal encontró familia con otra solicitud o se adoptó por otra vía. */
  CLOSED: "closed",
} as const;

export const ADOPTION_APPLICATION_STATUS_OPTIONS = [
  { label: "Enviada", value: ADOPTION_APPLICATION_STATUS.SUBMITTED },
  { label: "En revisión", value: ADOPTION_APPLICATION_STATUS.IN_REVIEW },
  { label: "Aprobada", value: ADOPTION_APPLICATION_STATUS.APPROVED },
  { label: "No aprobada", value: ADOPTION_APPLICATION_STATUS.REJECTED },
  { label: "Retirada", value: ADOPTION_APPLICATION_STATUS.WITHDRAWN },
  { label: "Adoptó", value: ADOPTION_APPLICATION_STATUS.COMPLETED },
  { label: "Cerrada", value: ADOPTION_APPLICATION_STATUS.CLOSED },
];

/** Siguen abiertas: cuentan para «una por animal» y se cierran cuando el animal encuentra familia. */
export const ADOPTION_APPLICATION_ACTIVE_STATUSES: string[] = [
  ADOPTION_APPLICATION_STATUS.SUBMITTED,
  ADOPTION_APPLICATION_STATUS.IN_REVIEW,
  ADOPTION_APPLICATION_STATUS.APPROVED,
];

/** Lo que quien revisa puede poner con `reviewAdoptionApplication`. */
export const ADOPTION_APPLICATION_REVIEW_STATUSES: string[] = [
  ADOPTION_APPLICATION_STATUS.IN_REVIEW,
  ADOPTION_APPLICATION_STATUS.APPROVED,
  ADOPTION_APPLICATION_STATUS.REJECTED,
];

export const ADOPTION_HOUSING_OPTIONS = [
  { label: "Casa", value: "house" },
  { label: "Departamento", value: "apartment" },
  { label: "Otro", value: "other" },
];

export const ADOPTION_HOUSING_OWNERSHIP_OPTIONS = [
  { label: "Propia", value: "own" },
  { label: "Rentada", value: "rent" },
  { label: "De mi familia", value: "family" },
];

export const ADOPTION_APPLICATION_LIMITS = {
  MESSAGE_MIN: 20,
  MESSAGE_MAX: 1000,
  TEXT_MAX: 500,
  NOTE_MAX: 500,
  HOURS_ALONE_MAX: 24,
};
