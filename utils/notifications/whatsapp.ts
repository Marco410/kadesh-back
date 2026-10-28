import { NOTIFICATION_TYPE, type NotificationType } from "../../models/Notification/constants";
import { sendWhatsAppTemplateMessage } from "../intregrations/whatsapp";
import { normalizeMxPhone } from "../pet/phone";

/** Valores crudos que llenan las variables de la plantilla (no se guardan en `Notification`). */
export type NotificationTemplateValues = Record<string, string | null | undefined>;

const TEMPLATE_LANGUAGE = "es_MX";
const PARAM_FALLBACK = "sin especificar";
const PARAM_MAX_LENGTH = 200;

/**
 * Una plantilla UTILITY aprobada por tipo, en el número de Kadesh. Un tipo que no está aquí no
 * sale por WhatsApp (solo queda en la campana). No hay plantilla genérica: Meta la clasificaba
 * como Marketing. Ver models/Notification/README.md.
 */
const WHATSAPP_TEMPLATES: Partial<
  Record<NotificationType, { name: string; params: (v: NotificationTemplateValues) => Array<string | null | undefined> }>
> = {
  [NOTIFICATION_TYPE.ANIMAL_CREATED]: {
    name: "kadesh_admin_animal_creado",
    params: (v) => [v.animalName, v.animalType, v.creatorName],
  },
  [NOTIFICATION_TYPE.PET_PLACE_SERVICE_REQUESTED]: {
    name: "kadesh_admin_servicio_solicitado",
    params: (v) => [v.serviceName, v.petPlaceName, v.requesterName],
  },
  [NOTIFICATION_TYPE.USER_BANK_DETAILS_UPDATED]: {
    name: "kadesh_admin_datos_bancarios",
    params: (v) => [v.userName],
  },
};

export function hasWhatsappTemplate(type: NotificationType): boolean {
  return Boolean(WHATSAPP_TEMPLATES[type]);
}

/** Número de WhatsApp de Kadesh (no el BYOK de cada empresa). Sin las dos variables no se manda nada. */
export function platformWhatsappConfig(): { phoneNumberId: string; accessToken: string } | null {
  const phoneNumberId = process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_PLATFORM_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

/** Meta rechaza parámetros vacíos o con saltos de línea, tabs o muchos espacios seguidos. */
function templateParam(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!clean) return PARAM_FALLBACK;
  return clean.length > PARAM_MAX_LENGTH ? `${clean.slice(0, PARAM_MAX_LENGTH - 1)}…` : clean;
}

/** "443 521 5638" → "524435215638". Un número de otro país con lada (11+ dígitos) va tal cual. */
function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const mx = normalizeMxPhone(raw);
  if (mx.ok) return `52${mx.digits}`;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 11 ? digits : null;
}

/**
 * Busca, entre los destinatarios de la notificación, a quien activó `whatsappNotifications` y tiene
 * teléfono, y les manda la plantilla. Nunca lanza: lo llama `notify` sin esperar.
 * `User.phone` no es nullable en la base (vacío es `""`): filtrar con `not: null` hace fallar a Prisma.
 */
export async function sendNotificationWhatsappToOptedIn(
  prisma: any,
  recipientIds: string[],
  type: NotificationType,
  values: NotificationTemplateValues,
): Promise<void> {
  try {
    if (!hasWhatsappTemplate(type) || !platformWhatsappConfig()) return;

    const optedIn = await prisma.user.findMany({
      where: { id: { in: recipientIds }, whatsappNotifications: true, phone: { not: "" } },
      select: { id: true, phone: true },
    });
    // Prisma de Keystone puede devolver el error en vez de lanzarlo.
    if (optedIn instanceof Error) throw optedIn;
    if (!Array.isArray(optedIn) || optedIn.length === 0) return;

    await sendNotificationWhatsapp(optedIn, type, values);
  } catch (error) {
    console.error("[notify:whatsapp] No se pudo buscar a quién mandarle:", type, error);
  }
}

/**
 * Manda la plantilla del tipo a cada destinatario. Nunca lanza: un fallo de Meta no debe tocar la
 * notificación de la campana ni la operación que la disparó. En logs solo los últimos 4 dígitos.
 */
export async function sendNotificationWhatsapp(
  recipients: Array<{ id: string; phone?: string | null }>,
  type: NotificationType,
  values: NotificationTemplateValues,
): Promise<void> {
  try {
    const template = WHATSAPP_TEMPLATES[type];
    const config = platformWhatsappConfig();
    if (!template || !config) return;

    const bodyParams = template.params(values).map(templateParam);

    await Promise.allSettled(
      recipients.map(async (recipient) => {
        const to = toWhatsappNumber(recipient.phone);
        if (!to) return;
        try {
          await sendWhatsAppTemplateMessage({
            ...config,
            to,
            templateName: template.name,
            language: TEMPLATE_LANGUAGE,
            bodyParams,
          });
        } catch (error) {
          console.error(
            `[notify:whatsapp] ${type} a usuario ${recipient.id} (…${to.slice(-4)}):`,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );
  } catch (error) {
    console.error("[notify:whatsapp] No se pudo mandar:", type, error);
  }
}
