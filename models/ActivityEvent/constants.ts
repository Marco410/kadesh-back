/**
 * Catálogo de eventos de actividad (`ActivityEvent.type`).
 * `type` es texto y no un select para poder agregar eventos sin migrar.
 * La categoría sale del prefijo (`lead.` → crm) y coincide con los tipos del feed de Operaciones.
 */

export const ACTIVITY_CATEGORY = {
  AUTH: "auth",
  EXTRACTION: "extraction",
  CRM: "crm",
  TEAM: "team",
  AI: "ai",
  CREDITS: "credits",
  BILLING: "billing",
  WHATSAPP: "whatsapp",
  CALENDAR: "calendar",
  ADMIN: "admin",
  PRODUCT: "product",
  ERRORS: "errors",
  PET: "pet",
  SECURITY: "security",
} as const;

export type ActivityCategory =
  (typeof ACTIVITY_CATEGORY)[keyof typeof ACTIVITY_CATEGORY];

export const ACTIVITY_CATEGORY_OPTIONS = [
  { label: "Accesos", value: ACTIVITY_CATEGORY.AUTH },
  { label: "Extracción", value: ACTIVITY_CATEGORY.EXTRACTION },
  { label: "CRM", value: ACTIVITY_CATEGORY.CRM },
  { label: "Equipo y empresa", value: ACTIVITY_CATEGORY.TEAM },
  { label: "IA", value: ACTIVITY_CATEGORY.AI },
  { label: "Créditos", value: ACTIVITY_CATEGORY.CREDITS },
  { label: "Plan y pagos", value: ACTIVITY_CATEGORY.BILLING },
  { label: "WhatsApp", value: ACTIVITY_CATEGORY.WHATSAPP },
  { label: "Calendario", value: ACTIVITY_CATEGORY.CALENDAR },
  { label: "Kadesh (admin)", value: ACTIVITY_CATEGORY.ADMIN },
  { label: "Navegación", value: ACTIVITY_CATEGORY.PRODUCT },
  { label: "Errores", value: ACTIVITY_CATEGORY.ERRORS },
  { label: "Kadesh Pet", value: ACTIVITY_CATEGORY.PET },
  { label: "Seguridad", value: ACTIVITY_CATEGORY.SECURITY },
] as const;

/** Quién originó el evento. */
export const ACTIVITY_SOURCE = {
  /** Una persona desde el panel (API con sesión). */
  WEB: "web",
  /** Un admin de Kadesh actuando sobre datos de otra empresa. */
  ADMIN: "admin",
  /** Aviso de un proveedor (Stripe). */
  WEBHOOK: "webhook",
  /** Proceso del servidor sin persona detrás (sync con Stripe al abrir el panel, scripts). */
  SYSTEM: "system",
} as const;

export type ActivitySource = (typeof ACTIVITY_SOURCE)[keyof typeof ACTIVITY_SOURCE];

export const ACTIVITY_SOURCE_OPTIONS = [
  { label: "Panel", value: ACTIVITY_SOURCE.WEB },
  { label: "Admin de Kadesh", value: ACTIVITY_SOURCE.ADMIN },
  { label: "Webhook", value: ACTIVITY_SOURCE.WEBHOOK },
  { label: "Sistema", value: ACTIVITY_SOURCE.SYSTEM },
] as const;

export const ACTIVITY_EVENT = {
  // Accesos
  AUTH_LOGOUT: "auth.logout",

  // CRM: leads
  LEAD_ADDED_MANUALLY: "lead.added_manually",
  LEAD_PROMOTED_FROM_INEGI: "lead.promoted_from_inegi",
  LEAD_STATUS_CHANGED: "lead.status_changed",
  LEAD_ASSIGNED: "lead.assigned",
  LEAD_OPPORTUNITY_CHANGED: "lead.opportunity_changed",
  LEAD_UPDATED: "lead.updated",
  LEAD_REMOVED: "lead.removed",
  LEAD_DELETED: "lead.deleted",
  LEAD_EXPORTED: "lead.exported",

  // CRM: cotizaciones (un tipo por estatus: el feed ya muestra "enviada" y "aceptada" desde SaasQuotation)
  QUOTATION_SENT: "quotation.sent",
  QUOTATION_ACCEPTED: "quotation.accepted",
  QUOTATION_REJECTED: "quotation.rejected",
  QUOTATION_EXPIRED: "quotation.expired",
  QUOTATION_REOPENED: "quotation.reopened",
  QUOTATION_DELETED: "quotation.deleted",

  // CRM: propuestas, proyectos, seguimientos, tareas, archivos
  PROPOSAL_STATUS_CHANGED: "proposal.status_changed",
  PROPOSAL_DELETED: "proposal.deleted",
  PROJECT_CREATED: "project.created",
  PROJECT_STATUS_CHANGED: "project.status_changed",
  PROJECT_DELETED: "project.deleted",
  FOLLOWUP_CREATED: "followup.created",
  FOLLOWUP_STATUS_CHANGED: "followup.status_changed",
  FOLLOWUP_DELETED: "followup.deleted",
  TASK_CREATED: "task.created",
  TASK_DELETED: "task.deleted",
  ACTIVITY_DELETED: "activity.deleted",
  BOARD_CARD_MOVED: "board.card_moved",
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",

  // Equipo y empresa
  TEAM_USER_CREATED: "team.user_created",
  TEAM_USER_UPDATED: "team.user_updated",
  TEAM_ROLES_CHANGED: "team.roles_changed",
  TEAM_PERMISSIONS_CHANGED: "team.permissions_changed",
  TEAM_COMPANY_CHANGED: "team.company_changed",
  TEAM_USER_DELETED: "team.user_deleted",
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_DELETED: "workspace.deleted",
  WORKSPACE_MEMBERS_CHANGED: "workspace.members_changed",
  COMPANY_UPDATED: "company.updated",

  // Integraciones y ajustes
  AI_SETTINGS_UPDATED: "ai.settings_updated",
  WHATSAPP_SETTINGS_UPDATED: "whatsapp.settings_updated",
  WHATSAPP_CONVERSATION_ASSIGNED: "whatsapp.conversation_assigned",
  WHATSAPP_CONTACT_LINKED: "whatsapp.contact_linked",
  WHATSAPP_CHAT_IMPORTED: "whatsapp.chat_imported",
  CALENDAR_CONNECTED: "calendar.connected",
  CALENDAR_DISCONNECTED: "calendar.disconnected",

  // Créditos
  CREDITS_EXHAUSTED: "credits.exhausted",

  // Plan y pagos (Stripe)
  BILLING_STATUS_CHANGED: "billing.status_changed",
  BILLING_RENEWED: "billing.renewed",
  BILLING_PAYMENT_FAILED: "billing.payment_failed",
  BILLING_REFUNDED: "billing.refunded",
  BILLING_CANCELLED: "billing.cancelled",

  // Kadesh (admin de plataforma)
  ADMIN_VIEWED_COMPANY: "admin.viewed_company",
  ADMIN_VIEWED_PERSON: "admin.viewed_person",
  ADMIN_VIEWED_AI_PROMPT: "admin.viewed_ai_prompt",
  ADMIN_SUBSCRIPTION_CHANGED: "admin.subscription_changed",
  ADMIN_PLAN_CATALOG_CHANGED: "admin.plan_catalog_changed",
  ADMIN_CREDIT_PACKAGE_CHANGED: "admin.credit_package_changed",
  ADMIN_FEATURE_CATALOG_UPDATED: "admin.feature_catalog_updated",
  ADMIN_EMAIL_BROADCAST: "admin.email_broadcast",
  // Control de cuentas (fase 3)
  ADMIN_COMPANY_SUSPENDED: "admin.company_suspended",
  ADMIN_COMPANY_REACTIVATED: "admin.company_reactivated",
  ADMIN_USER_SUSPENDED: "admin.user_suspended",
  ADMIN_USER_REACTIVATED: "admin.user_reactivated",
  ADMIN_SESSIONS_REVOKED: "admin.sessions_revoked",
  ADMIN_TRIAL_EXTENDED: "admin.trial_extended",
  ADMIN_IMPERSONATION_STARTED: "admin.impersonation_started",
  ADMIN_IMPERSONATION_ENDED: "admin.impersonation_ended",
  ADMIN_OWNERSHIP_TRANSFERRED: "admin.ownership_transferred",
  ADMIN_ACCOUNT_MANAGER_ASSIGNED: "admin.account_manager_assigned",
  ADMIN_NOTE_ADDED: "admin.note_added",
  ADMIN_NOTE_DELETED: "admin.note_deleted",
  // Kadesh Pet: alertas de zona de una persona (Operaciones → Kadesh Pet → Alertas de zona).
  ADMIN_ZONE_ALERTS_UPDATED: "admin.zone_alerts_updated",
  ADMIN_PERSON_DATA_EXPORTED: "admin.person_data_exported",
  // Bandeja de Errores (fase 6.2): resolver, ignorar o reabrir un error agrupado.
  ADMIN_ERROR_ISSUE_UPDATED: "admin.error_issue_updated",
  ADMIN_USER_ANONYMIZED: "admin.user_anonymized",

  // Kadesh Pet (fase 6.4): lo que hace la gente en pet.kadesh.com.mx y la app. Nunca el texto de
  // comentarios ni reseñas: solo ids, largo y calificación.
  PET_ANIMAL_REPORTED: "pet.animal_reported",
  PET_ANIMAL_UPDATED: "pet.animal_updated",
  PET_ANIMAL_DELETED: "pet.animal_deleted",
  PET_ANIMAL_STATUS_CHANGED: "pet.animal_status_changed",
  PET_ANIMAL_LOG_DELETED: "pet.animal_log_deleted",
  PET_COMMENT_ADDED: "pet.comment_added",
  PET_COMMENT_DELETED: "pet.comment_deleted",
  PET_CLAIM_REQUESTED: "pet.claim_requested",
  PET_CLAIM_CANCELLED: "pet.claim_cancelled",
  PET_PLACE_REGISTERED: "pet.place_registered",
  PET_PLACE_UPDATED: "pet.place_updated",
  PET_PLACE_CLAIMED: "pet.place_claimed",
  PET_PLACE_VERIFIED: "pet.place_verified",
  PET_REVIEW_ADDED: "pet.review_added",
  PET_REVIEW_DELETED: "pet.review_deleted",
  // Eventos (campañas, jornadas): publicar, editar, revisar (admin) y cancelar.
  PET_EVENT_SUBMITTED: "pet.event_submitted",
  PET_EVENT_UPDATED: "pet.event_updated",
  PET_EVENT_REVIEWED: "pet.event_reviewed",
  PET_EVENT_CANCELLED: "pet.event_cancelled",
  // Espacios de rescate: activar, cambiar estado (admin) y equipo.
  PET_RESCUE_CREATED: "pet.rescue_created",
  PET_RESCUE_STATUS_CHANGED: "pet.rescue_status_changed",
  PET_RESCUE_MEMBER_ADDED: "pet.rescue_member_added",
  PET_RESCUE_MEMBER_UPDATED: "pet.rescue_member_updated",
  PET_RESCUE_MEMBER_REMOVED: "pet.rescue_member_removed",
  // Ficha interna: crearla desde un reporte, publicarla y completar la adopción.
  PET_RESCUE_PET_CREATED: "pet.rescue_pet_created",
  PET_RESCUE_PET_PUBLISHED: "pet.rescue_pet_published",
  PET_RESCUE_ADOPTION_COMPLETED: "pet.rescue_adoption_completed",
  // «Se quedó conmigo»: quien publicó el reporte lo pasa a su cartilla.
  PET_ANIMAL_KEPT: "pet.animal_kept",
  // Solicitudes de adopción y traspasos de cartilla con código.
  PET_ADOPTION_APPLICATION_SUBMITTED: "pet.adoption_application_submitted",
  PET_ADOPTION_APPLICATION_EDITED: "pet.adoption_application_edited",
  PET_ADOPTION_APPLICATION_REVIEWED: "pet.adoption_application_reviewed",
  PET_ADOPTION_APPLICATION_WITHDRAWN: "pet.adoption_application_withdrawn",
  PET_ADOPTION_APPLICATION_COMPLETED: "pet.adoption_application_completed",
  PET_TRANSFER_CODE_CREATED: "pet.transfer_code_created",
  PET_TRANSFER_CODE_CANCELLED: "pet.transfer_code_cancelled",
  PET_TRANSFER_REDEEMED: "pet.transfer_redeemed",
  // Alta con el formulario genérico (Kadesh Pet web y app). Negocios y Google ya quedan en UserAuthLog.
  AUTH_SIGNUP: "auth.signup",
  // Formulario de contacto (landing y Negocios); sin datos personales en metadata.
  CONTACT_FORM_SUBMITTED: "contact.form_submitted",

  // Seguridad (fase 6.5): límites rebasados y bloqueos de IP.
  SECURITY_RATE_LIMITED: "security.rate_limited",
  ADMIN_IP_BLOCKED: "admin.ip_blocked",
  ADMIN_IP_UNBLOCKED: "admin.ip_unblocked",

  // Navegación (lo manda el front con trackEvents)
  UI_SECTION_VIEWED: "ui.section_viewed",
  UI_FEATURE_LOCKED_VIEWED: "ui.feature_locked_viewed",
  UI_UPGRADE_CLICKED: "ui.upgrade_clicked",
  UI_TOUR_COMPLETED: "ui.tour_completed",
  UI_TOUR_SKIPPED: "ui.tour_skipped",

  // Errores que vio alguien en el panel (plugin de Apollo, fase 5)
  APP_ERROR: "app.error",
  // Errores que solo ve el navegador: red caída, respuesta 5xx/413/429, pantalla caída (fase 6.1)
  APP_CLIENT_ERROR: "app.client_error",
} as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT)[keyof typeof ACTIVITY_EVENT];

/** Latido del front: no se guarda como evento, suma minutos en `UserActivityDay`. */
export const HEARTBEAT_EVENT = "auth.heartbeat";

/** Minutos que suma cada latido (el front lo manda cada 5 min con la pestaña visible). */
export const HEARTBEAT_MINUTES = 5;

/** Lo que cualquier persona con sesión puede reportar con `trackEvents`. */
export const CLIENT_EVENT_TYPES: ReadonlySet<string> = new Set([
  ACTIVITY_EVENT.APP_CLIENT_ERROR,
  ACTIVITY_EVENT.AUTH_LOGOUT,
  ACTIVITY_EVENT.LEAD_EXPORTED,
  ACTIVITY_EVENT.UI_SECTION_VIEWED,
  ACTIVITY_EVENT.UI_FEATURE_LOCKED_VIEWED,
  ACTIVITY_EVENT.UI_UPGRADE_CLICKED,
  ACTIVITY_EVENT.UI_TOUR_COMPLETED,
  ACTIVITY_EVENT.UI_TOUR_SKIPPED,
]);

/**
 * Lo único que un visitante sin sesión puede reportar con `trackEvents`, con tope por IP
 * (la mayoría de quienes usan Kadesh Pet navega sin cuenta).
 */
export const ANONYMOUS_CLIENT_EVENT_TYPES: ReadonlySet<string> = new Set([
  ACTIVITY_EVENT.APP_CLIENT_ERROR,
]);

/** Tipos de error de la app: los agrupa la bandeja de Errores (`fingerprint`). */
export const APP_ERROR_TYPES: readonly string[] = [
  ACTIVITY_EVENT.APP_ERROR,
  ACTIVITY_EVENT.APP_CLIENT_ERROR,
];

/** Qué app hizo la petición (header `x-kadesh-app`, o el `origin` si no viene). */
export const ACTIVITY_APP = {
  PET_WEB: "pet-web",
  BUSINESS_WEB: "business-web",
  PET_MOBILE: "pet-mobile",
} as const;

export type ActivityApp = (typeof ACTIVITY_APP)[keyof typeof ACTIVITY_APP];

export const ACTIVITY_APP_VALUES: ReadonlySet<string> = new Set(Object.values(ACTIVITY_APP));

/** Solo el admin de plataforma puede reportarlos: registro de qué datos de clientes abrió. */
export const CLIENT_ADMIN_EVENT_TYPES: ReadonlySet<string> = new Set([
  ACTIVITY_EVENT.ADMIN_VIEWED_COMPANY,
  ACTIVITY_EVENT.ADMIN_VIEWED_PERSON,
  ACTIVITY_EVENT.ADMIN_VIEWED_AI_PROMPT,
]);

/**
 * Se guardan para analítica, pero el feed de Operaciones no los repite:
 * ya salen de su propia tabla (hitos de `SaasQuotation`, cobros de `SaasPayment`).
 */
export const FEED_HIDDEN_EVENT_TYPES: readonly string[] = [
  ACTIVITY_EVENT.QUOTATION_SENT,
  ACTIVITY_EVENT.QUOTATION_ACCEPTED,
  ACTIVITY_EVENT.BILLING_PAYMENT_FAILED,
  ACTIVITY_EVENT.BILLING_REFUNDED,
];

const CATEGORY_BY_PREFIX: Record<string, ActivityCategory> = {
  auth: ACTIVITY_CATEGORY.AUTH,
  extraction: ACTIVITY_CATEGORY.EXTRACTION,
  lead: ACTIVITY_CATEGORY.CRM,
  quotation: ACTIVITY_CATEGORY.CRM,
  proposal: ACTIVITY_CATEGORY.CRM,
  project: ACTIVITY_CATEGORY.CRM,
  followup: ACTIVITY_CATEGORY.CRM,
  task: ACTIVITY_CATEGORY.CRM,
  activity: ACTIVITY_CATEGORY.CRM,
  board: ACTIVITY_CATEGORY.CRM,
  file: ACTIVITY_CATEGORY.CRM,
  team: ACTIVITY_CATEGORY.TEAM,
  workspace: ACTIVITY_CATEGORY.TEAM,
  company: ACTIVITY_CATEGORY.TEAM,
  ai: ACTIVITY_CATEGORY.AI,
  credits: ACTIVITY_CATEGORY.CREDITS,
  billing: ACTIVITY_CATEGORY.BILLING,
  whatsapp: ACTIVITY_CATEGORY.WHATSAPP,
  calendar: ACTIVITY_CATEGORY.CALENDAR,
  admin: ACTIVITY_CATEGORY.ADMIN,
  ui: ACTIVITY_CATEGORY.PRODUCT,
  app: ACTIVITY_CATEGORY.ERRORS,
  pet: ACTIVITY_CATEGORY.PET,
  // Antes de la fase 6.4 los eventos de animales usaban `animal.*` (reclamos).
  animal: ACTIVITY_CATEGORY.PET,
  // Uso del sitio: sale en Navegación.
  contact: ACTIVITY_CATEGORY.PRODUCT,
  security: ACTIVITY_CATEGORY.SECURITY,
};

export function categoryForType(type: string): ActivityCategory {
  const prefix = type.split(".")[0] ?? "";
  return CATEGORY_BY_PREFIX[prefix] ?? ACTIVITY_CATEGORY.PRODUCT;
}

/** Eventos crudos que se conservan (meses). Ver `scripts/pruneActivityEvents.ts`. */
export const ACTIVITY_RETENTION_MONTHS = 13;
