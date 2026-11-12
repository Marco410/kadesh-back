/**
 * Eventos de Kadesh Pet: campañas de esterilización, vacunación, ferias de adopción… Los publica
 * cualquier persona con sesión y un admin los revisa en Operaciones → Kadesh Pet → Eventos.
 * Ver README.md. El front (`kadesh/components/events/constants.ts`) repite estos valores.
 */

import { ANIMAL_TYPE_OPTIONS } from "../../../utils/constants/constants";

export const PET_EVENT_STATUS = {
  /** Lo mandó alguien que no es admin (o lo editó): espera revisión y no es público. */
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  /** Lo canceló quien lo organiza o un admin. Si llegó a publicarse, la ficha sigue visible. */
  CANCELLED: "cancelled",
} as const;

export type PetEventStatus = (typeof PET_EVENT_STATUS)[keyof typeof PET_EVENT_STATUS];

export const PET_EVENT_STATUS_OPTIONS = [
  { label: "En revisión", value: PET_EVENT_STATUS.PENDING },
  { label: "Publicado", value: PET_EVENT_STATUS.APPROVED },
  { label: "Rechazado", value: PET_EVENT_STATUS.REJECTED },
  { label: "Cancelado", value: PET_EVENT_STATUS.CANCELLED },
];

export const PET_EVENT_CATEGORY = {
  STERILIZATION: "esterilizacion",
  VACCINATION: "vacunacion",
  ADOPTION: "adopcion",
  DEWORMING: "desparasitacion",
  VET_CARE: "consulta",
  FUNDRAISER: "colecta",
  VOLUNTEERING: "voluntariado",
  WORKSHOP: "taller",
  OTHER: "otro",
} as const;

export type PetEventCategory = (typeof PET_EVENT_CATEGORY)[keyof typeof PET_EVENT_CATEGORY];

/** `label` para listas; `title` para avisos ("Campaña de esterilización cerca de ti"). */
export const PET_EVENT_CATEGORY_OPTIONS: Array<{ label: string; value: PetEventCategory; title: string }> = [
  { label: "Esterilización", value: PET_EVENT_CATEGORY.STERILIZATION, title: "Campaña de esterilización" },
  { label: "Vacunación", value: PET_EVENT_CATEGORY.VACCINATION, title: "Jornada de vacunación" },
  { label: "Adopción", value: PET_EVENT_CATEGORY.ADOPTION, title: "Feria de adopción" },
  { label: "Desparasitación", value: PET_EVENT_CATEGORY.DEWORMING, title: "Jornada de desparasitación" },
  { label: "Consulta / jornada médica", value: PET_EVENT_CATEGORY.VET_CARE, title: "Jornada médica" },
  { label: "Colecta / acopio", value: PET_EVENT_CATEGORY.FUNDRAISER, title: "Colecta" },
  { label: "Voluntariado", value: PET_EVENT_CATEGORY.VOLUNTEERING, title: "Voluntariado" },
  { label: "Taller / plática", value: PET_EVENT_CATEGORY.WORKSHOP, title: "Taller" },
  { label: "Otro", value: PET_EVENT_CATEGORY.OTHER, title: "Evento" },
];

/**
 * Para qué animales es: los mismos tipos que un reporte (`AnimalType`), como en los espacios de
 * rescate. Hay eventos guardados con el valor viejo `other` («Otros»): se leen tal cual, pero ya no se
 * aceptan al guardar (`normalizePetEventInput` los quita).
 */
export const PET_EVENT_SPECIES_OPTIONS = ANIMAL_TYPE_OPTIONS;

/** A quién «le toca» el evento: filtros y avisos de zona. */
export const PET_EVENT_SCOPE = {
  /** Un radio (`reachKm`) alrededor del punto. */
  ZONE: "zone",
  /** El municipio del punto. */
  CITY: "city",
  /** El estado del punto. */
  STATE: "state",
  /** Todo el país. Solo lo eligen admins (avisa a todas las personas con zona). */
  NATIONAL: "national",
} as const;

export type PetEventScope = (typeof PET_EVENT_SCOPE)[keyof typeof PET_EVENT_SCOPE];

export const PET_EVENT_SCOPE_OPTIONS = [
  { label: "Zona (radio en km)", value: PET_EVENT_SCOPE.ZONE },
  { label: "Municipio", value: PET_EVENT_SCOPE.CITY },
  { label: "Estado", value: PET_EVENT_SCOPE.STATE },
  { label: "Nacional", value: PET_EVENT_SCOPE.NATIONAL },
];

export const PET_EVENT_REACH_KM_OPTIONS = [5, 10, 20, 50] as const;
export const DEFAULT_PET_EVENT_REACH_KM = 10;

export const PET_EVENT_INTEREST_KIND = {
  INTERESTED: "interested",
  GOING: "going",
} as const;

export type PetEventInterestKind = (typeof PET_EVENT_INTEREST_KIND)[keyof typeof PET_EVENT_INTEREST_KIND];

export const PET_EVENT_INTEREST_KIND_OPTIONS = [
  { label: "Me interesa", value: PET_EVENT_INTEREST_KIND.INTERESTED },
  { label: "Asistiré", value: PET_EVENT_INTEREST_KIND.GOING },
];

/**
 * Redes del evento (o de quien lo organiza). Se aceptan el link o el usuario (`@refugio`); se
 * guardan como link completo. `hosts`: dominios válidos para esa red.
 */
export const PET_EVENT_SOCIAL_NETWORKS = {
  facebookUrl: { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], profileBase: "https://www.facebook.com/" },
  instagramUrl: { label: "Instagram", hosts: ["instagram.com"], profileBase: "https://www.instagram.com/" },
  tiktokUrl: { label: "TikTok", hosts: ["tiktok.com"], profileBase: "https://www.tiktok.com/@" },
  xUrl: { label: "X", hosts: ["x.com", "twitter.com"], profileBase: "https://x.com/" },
} as const;

export type PetEventSocialField = keyof typeof PET_EVENT_SOCIAL_NETWORKS;

export const PET_EVENT_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 120,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  REQUIREMENTS_MAX: 1000,
  ORGANIZER_MAX: 120,
  PLACE_LABEL_MAX: 160,
  PRICE_NOTE_MAX: 120,
  PRICE_MAX: 100_000,
  CAPACITY_MAX: 100_000,
  URL_MAX: 500,
  CANCEL_REASON_MAX: 500,
  REVIEW_NOTE_MAX: 500,
  /** Fechas por evento (un evento semanal de 6 meses son ~26). */
  MAX_SESSIONS: 30,
  /** Una sola fecha puede abarcar varios días, hasta 7. */
  MAX_SESSION_DAYS: 7,
  /** Ninguna fecha más allá de 12 meses. */
  MAX_MONTHS_AHEAD: 12,
  MAX_PHOTOS: 6,
} as const;

/** Avisos (ver utils/notifications/eventAlerts.ts). */
export const PET_EVENT_ALERTS = {
  /** Máximo de avisos de eventos de zona por persona en 24 h (aparte de las alertas de mascotas). */
  MAX_PER_DAY: 3,
  /** Se avisa a la zona cuando la próxima fecha está a 14 días o menos. */
  LEAD_DAYS: 14,
  /** El recordatorio sale cuando falta esto (o menos) para la fecha. */
  REMINDER_HOURS: 24,
} as const;

/**
 * Vistas de la ficha (`recordPetEventView`): la misma persona (o la misma IP + navegador, sin
 * sesión) suma una vista por evento en esta ventana, por más que recargue.
 */
export const PET_EVENT_VIEW_DEDUPE_MS = 30 * 60 * 1000;
