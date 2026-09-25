/** Feature de plan que habilita el calendario (ver models/Saas/SaasPlan/plan_features.json). */
export const GOOGLE_CALENDAR_FEATURE_KEY = "calendar_crm";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export enum GoogleCalendarScopeType {
  PERSONAL = "personal",
  COMPANY = "company",
}

export const GOOGLE_CALENDAR_SCOPE_TYPE_OPTIONS = [
  { label: "Personal", value: GoogleCalendarScopeType.PERSONAL },
  { label: "Compartida (empresa)", value: GoogleCalendarScopeType.COMPANY },
] as const;

export enum CalendarEventSource {
  NATIVE = "native",
  SALES_ACTIVITY = "sales_activity",
  FOLLOW_UP_TASK = "follow_up_task",
  TASK = "task",
  PROPOSAL = "proposal",
}

export const CALENDAR_EVENT_SOURCE_OPTIONS = [
  { label: "Nativo", value: CalendarEventSource.NATIVE },
  { label: "Actividad de venta", value: CalendarEventSource.SALES_ACTIVITY },
  { label: "Tarea de seguimiento", value: CalendarEventSource.FOLLOW_UP_TASK },
  { label: "Tarea", value: CalendarEventSource.TASK },
  { label: "Propuesta", value: CalendarEventSource.PROPOSAL },
] as const;

export enum GoogleLinkStatus {
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

export const GOOGLE_LINK_STATUS_OPTIONS = [
  { label: "Pendiente", value: GoogleLinkStatus.PENDING },
  { label: "Exitoso", value: GoogleLinkStatus.SUCCESS },
  { label: "Error", value: GoogleLinkStatus.ERROR },
] as const;

export const GOOGLE_SYNC_DIRECTION_OPTIONS = [
  { label: "Push (Kadesh → Google)", value: "push" },
  { label: "Pull (Google → Kadesh)", value: "pull" },
] as const;

export const GOOGLE_SYNC_OPERATION_OPTIONS = [
  { label: "Crear", value: "create" },
  { label: "Actualizar", value: "update" },
  { label: "Eliminar", value: "delete" },
  { label: "Listar eventos", value: "list_events" },
  { label: "Listar calendarios", value: "list_calendars" },
  { label: "Refrescar token", value: "token_refresh" },
] as const;

export type GoogleSyncDirection = "push" | "pull";
export type GoogleSyncOperation =
  | "create"
  | "update"
  | "delete"
  | "list_events"
  | "list_calendars"
  | "token_refresh";

/** Duración por defecto (min) de eventos generados desde CRM que no tienen fin. */
export const DEFAULT_EVENT_DURATION_MINUTES = 60;
