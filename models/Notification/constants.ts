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
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
