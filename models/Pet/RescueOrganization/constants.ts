/**
 * Espacios de rescate: rescatistas, refugios, hogares temporales, colectivos y asociaciones.
 * Ver README.md. Los valores se repiten en el front (`kadesh/components/rescue/constants.ts`).
 */

export const RESCUE_ORG_TYPE = {
  INDEPENDENT: "independent",
  SHELTER: "shelter",
  FOSTER_HOME: "foster_home",
  COLLECTIVE: "collective",
  CIVIL_ASSOCIATION: "civil_association",
} as const;

export const RESCUE_ORG_TYPE_OPTIONS = [
  { label: "Rescatista independiente", value: RESCUE_ORG_TYPE.INDEPENDENT },
  { label: "Refugio o santuario", value: RESCUE_ORG_TYPE.SHELTER },
  { label: "Hogar temporal", value: RESCUE_ORG_TYPE.FOSTER_HOME },
  { label: "Colectivo", value: RESCUE_ORG_TYPE.COLLECTIVE },
  { label: "Asociación civil o fundación", value: RESCUE_ORG_TYPE.CIVIL_ASSOCIATION },
];

/**
 * `pending`: recién activado, el equipo lo valida por WhatsApp. Mientras tanto la organización usa
 * su espacio, pero su nombre y su perfil no se muestran al público. `verified`: público.
 * `rejected` y `suspended`: no se puede publicar a su nombre ni se muestra.
 */
export const RESCUE_ORG_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
} as const;

export const RESCUE_ORG_STATUS_OPTIONS = [
  { label: "En revisión", value: RESCUE_ORG_STATUS.PENDING },
  { label: "Verificada", value: RESCUE_ORG_STATUS.VERIFIED },
  { label: "Rechazada", value: RESCUE_ORG_STATUS.REJECTED },
  { label: "Suspendida", value: RESCUE_ORG_STATUS.SUSPENDED },
];

/** Estados en los que el equipo puede seguir publicando y editando a nombre de la organización. */
export const RESCUE_ORG_ACTIVE_STATUSES: string[] = [RESCUE_ORG_STATUS.PENDING, RESCUE_ORG_STATUS.VERIFIED];

export const RESCUE_MEMBER_ROLE = {
  /** Todo: perfil, equipo y animales. */
  ADMIN: "admin",
  /** Perfil y animales (publicar, editar, borrar). No toca el equipo. */
  COORDINATOR: "coordinator",
  /** Publica y actualiza animales; no los borra. */
  VOLUNTEER: "volunteer",
  /** Hogar temporal: forma parte del equipo; en esta fase solo ve el espacio. */
  FOSTER: "foster",
} as const;

export type RescueMemberRole = (typeof RESCUE_MEMBER_ROLE)[keyof typeof RESCUE_MEMBER_ROLE];

export const RESCUE_MEMBER_ROLE_OPTIONS = [
  { label: "Administrador", value: RESCUE_MEMBER_ROLE.ADMIN },
  { label: "Coordinador", value: RESCUE_MEMBER_ROLE.COORDINATOR },
  { label: "Voluntario", value: RESCUE_MEMBER_ROLE.VOLUNTEER },
  { label: "Hogar temporal", value: RESCUE_MEMBER_ROLE.FOSTER },
];

export const RESCUE_MEMBER_ROLE_VALUES = new Set<string>(RESCUE_MEMBER_ROLE_OPTIONS.map((option) => option.value));

/** Editan el perfil público. */
export const RESCUE_PROFILE_EDITOR_ROLES: string[] = [RESCUE_MEMBER_ROLE.ADMIN, RESCUE_MEMBER_ROLE.COORDINATOR];
/** Publican y actualizan animales de la organización. */
export const RESCUE_ANIMAL_EDITOR_ROLES: string[] = [
  RESCUE_MEMBER_ROLE.ADMIN,
  RESCUE_MEMBER_ROLE.COORDINATOR,
  RESCUE_MEMBER_ROLE.VOLUNTEER,
];
/** Borran animales de la organización. */
export const RESCUE_ANIMAL_MANAGER_ROLES: string[] = [RESCUE_MEMBER_ROLE.ADMIN, RESCUE_MEMBER_ROLE.COORDINATOR];

export const RESCUE_ORG_LIMITS = {
  NAME_MIN: 3,
  NAME_MAX: 120,
  DESCRIPTION_MAX: 2000,
  CITY_MAX: 120,
  NEEDS_MAX: 1000,
  DONATION_INFO_MAX: 500,
  STATUS_NOTE_MAX: 500,
  URL_MAX: 500,
  CAPACITY_MAX: 100_000,
  /** Organizaciones que una persona puede activar (contra abuso; un admin no tiene tope). */
  MAX_CREATED_PER_USER: 3,
  /** Miembros por organización. */
  MAX_MEMBERS: 50,
};

/** Rutas fijas de la web bajo `/organizaciones/`. */
export const RESCUE_RESERVED_SLUGS = new Set(["nuevo", "registro", "activar", "aliados"]);
