/** Producto al que pertenece una notificación (Kadesh Pet o Kadesh Negocios). */
export const NOTIFICATION_PRODUCT = {
  PET: "pet",
  SAAS: "saas",
} as const;

export const NOTIFICATION_PRODUCT_OPTIONS = [
  { label: "Kadesh Pet", value: NOTIFICATION_PRODUCT.PET },
  { label: "Kadesh Negocios", value: NOTIFICATION_PRODUCT.SAAS },
];

/**
 * Tipos de notificación. Se agregan aquí y en el front (`kadesh/components/notifications`)
 * para el ícono y el texto del tipo. La plantilla de WhatsApp es opcional: sin una entrada en
 * `utils/notifications/whatsapp.ts` el tipo solo llega a la campana.
 */
export const NOTIFICATION_TYPE = {
  /** Un usuario (no admin) publicó un animal en Kadesh Pet. */
  ANIMAL_CREATED: "animal.created",
  /** Se reportó una mascota perdida o encontrada dentro del radio de alertas de la persona. */
  ANIMAL_NEARBY: "animal.nearby",
  /** Alguien comentó en un reporte. Va a quien lo reportó. */
  ANIMAL_COMMENTED: "animal.commented",
  /** Alguien iba a reportar el mismo animal y dejó un comentario en vez de duplicarlo. */
  ANIMAL_DUPLICATE_REPORTED: "animal.duplicate_reported",
  /** Un reporte perdido se parece a uno encontrado (o al revés): podría ser el mismo animal. */
  ANIMAL_POSSIBLE_MATCH: "animal.possible_match",
  /** Alguien dice que el animal de un reporte es suyo. Va a quien lo reportó (o a los admins). */
  ANIMAL_CLAIM_REQUESTED: "animal.claim_requested",
  /** Quien reportó aceptó la solicitud: el reporte ya es de quien lo pidió. */
  ANIMAL_CLAIM_APPROVED: "animal.claim_approved",
  /** La solicitud para quedarse con el reporte se rechazó. */
  ANIMAL_CLAIM_REJECTED: "animal.claim_rejected",
  /** Un admin unió un reporte repetido con el principal. Va a quien hizo el repetido. */
  ANIMAL_MERGED: "animal.merged",
  /** El dueño de una veterinaria pidió agregar un servicio al catálogo. */
  PET_PLACE_SERVICE_REQUESTED: "petplace.service_requested",
  /** Alguien cambió sus datos bancarios (comisiones de referidos). */
  USER_BANK_DETAILS_UPDATED: "user.bank_details_updated",
  /** Se acerca la fecha de un recordatorio de la cartilla (vacuna, desparasitación…). Va a sus dueños. */
  PET_REMINDER_DUE: "pet.reminder_due",
  /** Alguien se pasó de un límite contra abuso (login, registros, reportes…). Va a los admins. */
  SECURITY_ALERT: "security.alert",
  /** Un evento aprobado (campaña, jornada…) le toca a la zona, municipio o estado de la persona. */
  EVENT_NEARBY: "event.nearby",
  /** Falta un día (o menos) para una fecha de un evento que marcó «Me interesa» o «Asistiré». */
  EVENT_REMINDER: "event.reminder",
  /** Alguien publicó o editó un evento y espera revisión. Va a los admins. */
  EVENT_SUBMITTED: "event.submitted",
  /** Un admin aprobó el evento. Va a quien lo publicó. */
  EVENT_APPROVED: "event.approved",
  /** Un admin rechazó el evento (con motivo). Va a quien lo publicó. */
  EVENT_REJECTED: "event.rejected",
  /** Se canceló un evento. Va a quienes marcaron «Me interesa» o «Asistiré». */
  EVENT_CANCELLED: "event.cancelled",
  /** Cambiaron las fechas o el lugar de un evento. Va a quienes marcaron «Me interesa» o «Asistiré». */
  EVENT_UPDATED: "event.updated",
  /** Alguien activó un espacio de rescate y espera verificación. Va a los admins. */
  RESCUE_SUBMITTED: "rescue.submitted",
  /** Un admin verificó el espacio de rescate. Va a sus administradores. */
  RESCUE_VERIFIED: "rescue.verified",
  /** Un admin rechazó o suspendió el espacio de rescate. Va a sus administradores. */
  RESCUE_REJECTED: "rescue.rejected",
  /** Te agregaron al equipo de un espacio de rescate. Va a la persona agregada. */
  RESCUE_MEMBER_ADDED: "rescue.member_added",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/**
 * Cómo le fue a cada canal de una notificación (la campana siempre se guarda). Lo escriben
 * `push.ts`, `whatsapp.ts` y el webhook de WhatsApp; lo lee Operaciones → Kadesh Pet → Avisos.
 * `null` = el canal no aplica (push solo en Pet; WhatsApp solo en tipos con plantilla).
 */
export const PUSH_DELIVERY = {
  /** Expo aceptó el mensaje para todos sus dispositivos. */
  SENT: "sent",
  /** Para algunos dispositivos sí y para otros no. */
  PARTIAL: "partial",
  FAILED: "failed",
  /** No tiene la app con notificaciones activas. */
  NO_DEVICES: "no_devices",
} as const;

export const PUSH_DELIVERY_OPTIONS = [
  { label: "Enviado", value: PUSH_DELIVERY.SENT },
  { label: "Enviado a algunos dispositivos", value: PUSH_DELIVERY.PARTIAL },
  { label: "Falló", value: PUSH_DELIVERY.FAILED },
  { label: "Sin app", value: PUSH_DELIVERY.NO_DEVICES },
];

/** `accepted` → `sent` → `delivered` → `read` (los tres últimos los avisa Meta por webhook). */
export const WHATSAPP_DELIVERY = {
  /** No se mandó: ver `whatsappDetail` (WHATSAPP_SKIP_REASON). */
  SKIPPED: "skipped",
  /** Meta lo aceptó (tenemos `whatsappMessageId`). */
  ACCEPTED: "accepted",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  /** Meta lo rechazó al mandarlo o avisó después que no lo entregó: ver `whatsappDetail`. */
  FAILED: "failed",
} as const;

export type WhatsappDelivery = (typeof WHATSAPP_DELIVERY)[keyof typeof WHATSAPP_DELIVERY];

export const WHATSAPP_DELIVERY_OPTIONS = [
  { label: "No se mandó", value: WHATSAPP_DELIVERY.SKIPPED },
  { label: "Aceptado por Meta", value: WHATSAPP_DELIVERY.ACCEPTED },
  { label: "Enviado", value: WHATSAPP_DELIVERY.SENT },
  { label: "Entregado", value: WHATSAPP_DELIVERY.DELIVERED },
  { label: "Leído", value: WHATSAPP_DELIVERY.READ },
  { label: "Falló", value: WHATSAPP_DELIVERY.FAILED },
];

/** Por qué no salió un WhatsApp (va en `whatsappDetail` con status `skipped`). */
export const WHATSAPP_SKIP_REASON = {
  NO_CONFIG: "sin_configuracion",
  NO_OPT_IN: "sin_optin",
  NO_PHONE: "sin_telefono",
  INVALID_PHONE: "telefono_invalido",
  MUTED: "silenciado",
} as const;

