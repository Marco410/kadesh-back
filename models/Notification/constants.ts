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
  /** El dueño de una veterinaria pidió agregar un servicio al catálogo. */
  PET_PLACE_SERVICE_REQUESTED: "petplace.service_requested",
  /** Alguien cambió sus datos bancarios (comisiones de referidos). */
  USER_BANK_DETAILS_UPDATED: "user.bank_details_updated",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
