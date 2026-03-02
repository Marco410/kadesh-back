/**
 * Constantes para el módulo CRM (Business Leads, Pipeline comercial).
 * Usar en select options, hooks y access.
 */

export const PIPELINE_STATUS = {
  DETECTADO: "01 - Detectado",
  SELECCIONADO: "02 - Seleccionado",
  CONTACTADO: "03 - Contactado",
  SIN_RESPUESTA: "04 - Sin Respuesta",
  INTERESADO: "05 - Interesado",
  CREANDO_PROYECTO_PROPUESTA: "06 - Creando proyecto propuesta",
  PROPUESTA_ENVIADA: "07 - Propuesta Enviada",
  SEGUIMIENTO: "08 - Seguimiento",
  EN_NEGOCIACION: "09 - En Negociación",
  PROPUESTA_ACEPTADA: "10 - Propuesta Aceptada",
  PROPUESTA_RECHAZADA: "11 - Propuesta Rechazada",
  CERRADO_GANADO: "12 - Cerrado Ganado",
  CERRADO_PERDIDO: "13 - Cerrado Perdido",
  DESCARTADO: "14 - Descartado",
} as const;

export type PipelineStatusValue =
  (typeof PIPELINE_STATUS)[keyof typeof PIPELINE_STATUS];

export const OPPORTUNITY_LEVEL = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
} as const;

export const SALES_ACTIVITY_TYPE = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  REUNION: "Reunión",
} as const;

export const PROPOSAL_STATUS = {
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
} as const;

export const FOLLOW_UP_TASK_STATUS = {
  PENDIENTE: "Pendiente",
  COMPLETADO: "Completado",
} as const;

export const TASK_PRIORITY = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
} as const;

export const LEAD_SOURCE = {
  GOOGLE_MAPS: "Google Maps",
  REFERIDO: "Referido",
  WEB: "Web",
  OTRO: "Otro",
} as const;

/** Días por defecto para crear tarea de seguimiento cuando se envía propuesta */
export const DEFAULT_FOLLOW_UP_DAYS_AFTER_PROPOSAL = 3;
