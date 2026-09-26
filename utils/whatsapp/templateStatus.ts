/**
 * Traducción del estado de plantilla de Meta al valor que guarda `SaasCompany.whatsappTemplateStatus`.
 *
 * Vive aquí (y no en el webhook) porque hay dos fuentes del mismo dato: el evento
 * `message_template_status_update` y la consulta directa a la Graph API al probar la conexión.
 */
export const TEMPLATE_STATUS_MAP: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "pending",
  IN_APPEAL: "pending",
  PENDING_DELETION: "rejected",
  DELETED: "rejected",
  DISABLED: "rejected",
  PAUSED: "approved", // pausada por calidad: sigue existiendo y aprobada, Meta la reactiva sola
};

/** `null` cuando Meta manda un estado que no conocemos: mejor no tocar lo guardado. */
export function mapTemplateStatus(metaStatus: string | null | undefined): string | null {
  if (!metaStatus) return null;
  return TEMPLATE_STATUS_MAP[metaStatus.toUpperCase()] ?? null;
}
