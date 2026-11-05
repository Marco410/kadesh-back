/**
 * Límites contra abuso (fase 6.5). Cada regla cuenta intentos por IP o por persona en una ventana.
 * Al pasarse, la mutación responde `RATE_LIMITED` con un mensaje para la persona, queda
 * `security.rate_limited` en Actividad y, si se repite o es de login, se avisa a los admins.
 *
 * Los admins de plataforma y la automatización de reportes (`PET_AUTOMATION_TOKEN`) no tienen límite.
 */

export type RateLimitScope = "ip" | "user";

export type RateLimitRule = {
  /** Llave estable (va en Actividad y en Seguridad). */
  key: string;
  /** Texto para Operaciones. */
  label: string;
  /** Campos raíz de mutación que cuentan. */
  fields: readonly string[];
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
  /** Avisar a los admins desde la primera vez (p. ej. fuerza bruta en login). */
  alertAlways?: boolean;
  /**
   * Solo cuenta sin sesión. `createUser` también lo usan los admins de empresa para dar de alta a
   * su equipo; eso no es un registro.
   */
  anonymousOnly?: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Login con contraseña: solo cuentan los intentos fallidos (ver `passwordLoginAudit.ts`). */
export const LOGIN_FAILED_RULES = {
  perIp: { key: "login_failed_ip", label: "Logins fallidos por IP", limit: 10, windowMs: 15 * MINUTE },
  perEmail: { key: "login_failed_email", label: "Logins fallidos por correo", limit: 5, windowMs: 15 * MINUTE },
} as const;

export const RATE_LIMIT_RULES: readonly RateLimitRule[] = [
  {
    key: "google_login_ip",
    label: "Logins con Google por IP",
    fields: ["authenticateUserWithGoogle"],
    scope: "ip",
    limit: 20,
    windowMs: 15 * MINUTE,
  },
  {
    key: "signup_ip",
    label: "Registros por IP",
    fields: ["createUser", "registerUser"],
    scope: "ip",
    limit: 5,
    windowMs: HOUR,
    anonymousOnly: true,
  },
  {
    key: "animal_report_user",
    label: "Reportes de animales por persona",
    fields: ["createAnimal", "createAnimalReport"],
    scope: "user",
    limit: 10,
    windowMs: HOUR,
  },
  {
    key: "animal_report_ip",
    label: "Reportes de animales por IP",
    fields: ["createAnimal", "createAnimalReport"],
    scope: "ip",
    limit: 20,
    windowMs: HOUR,
  },
  {
    key: "pet_event_user",
    label: "Eventos publicados por persona",
    fields: ["submitPetEvent"],
    scope: "user",
    limit: 5,
    windowMs: DAY,
  },
  {
    key: "comment_user",
    label: "Comentarios por persona",
    fields: ["createAnimalComment", "createPostComment"],
    scope: "user",
    limit: 30,
    windowMs: HOUR,
  },
  {
    key: "review_user",
    label: "Reseñas por persona",
    fields: ["createReview"],
    scope: "user",
    limit: 10,
    windowMs: DAY,
  },
  {
    key: "contact_ip",
    label: "Mensajes de contacto por IP",
    fields: ["createContactForm", "createContactForms"],
    scope: "ip",
    limit: 5,
    windowMs: HOUR,
  },
  {
    key: "pet_place_ip",
    label: "Veterinarias registradas por IP",
    fields: ["createPetPlace"],
    scope: "ip",
    limit: 3,
    windowMs: DAY,
  },
];

export const RATE_LIMIT_RULE_LABELS: Record<string, string> = {
  ...Object.fromEntries(RATE_LIMIT_RULES.map((rule) => [rule.key, rule.label])),
  [LOGIN_FAILED_RULES.perIp.key]: LOGIN_FAILED_RULES.perIp.label,
  [LOGIN_FAILED_RULES.perEmail.key]: LOGIN_FAILED_RULES.perEmail.label,
};

/** Veces que la misma IP o persona se pasa de un límite en una hora antes de avisar a los admins. */
export const ALERT_AFTER_EXCEEDED = 3;
/** Entre dos avisos por la misma IP o persona. */
export const ALERT_COOLDOWN_MS = 30 * MINUTE;

export const RATE_LIMITED_CODE = "RATE_LIMITED";
export const IP_BLOCKED_CODE = "IP_BLOCKED";

export function rateLimitedMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Hiciste demasiadas solicitudes. Intenta de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}

export const IP_BLOCKED_MESSAGE =
  "Tu acceso a Kadesh está bloqueado. Escríbenos a contacto@kadesh.com.mx para revisarlo.";
