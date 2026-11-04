import { NOTIFICATION_TYPE, type NotificationType } from "../../models/Notification/constants";
import { sendWhatsAppTemplateMessage } from "../intregrations/whatsapp";
import { normalizeMxPhone } from "../pet/phone";
import { wantsWhatsappType } from "../../models/User/whatsappPrefs";

/** Valores crudos que llenan las variables de la plantilla (no se guardan en `Notification`). */
export type NotificationTemplateValues = Record<string, string | null | undefined>;

const TEMPLATE_LANGUAGE = "es_MX";
const PARAM_FALLBACK = "sin especificar";
const PARAM_MAX_LENGTH = 200;

type WhatsappTemplate = {
  name: string;
  /** `pet`: avisos de usuarios de Kadesh Pet. Que nadie tenga WhatsApp activo es lo normal: no se registra. */
  audience: "admin" | "pet";
  params: (v: NotificationTemplateValues) => Array<string | null | undefined>;
};

/**
 * Una plantilla UTILITY aprobada por tipo, en el número de Kadesh. Un tipo que no está aquí no
 * sale por WhatsApp (solo queda en la campana). No hay plantilla genérica: Meta la clasificaba
 * como Marketing. El texto de cada plantilla y sus ejemplos para Meta están en
 * models/Notification/README.md ("Plantillas"). El orden de `params` es el de las variables.
 */
const WHATSAPP_TEMPLATES: Partial<Record<NotificationType, WhatsappTemplate>> = {
  [NOTIFICATION_TYPE.ANIMAL_CREATED]: {
    name: "kadesh_admin_animal_creado",
    audience: "admin",
    params: (v) => [v.animalName, v.animalType, v.creatorName],
  },
  [NOTIFICATION_TYPE.PET_PLACE_SERVICE_REQUESTED]: {
    name: "kadesh_admin_servicio_solicitado",
    audience: "admin",
    params: (v) => [v.serviceName, v.petPlaceName, v.requesterName],
  },
  [NOTIFICATION_TYPE.USER_BANK_DETAILS_UPDATED]: {
    name: "kadesh_admin_datos_bancarios",
    audience: "admin",
    params: (v) => [v.userName],
  },
  // ── Kadesh Pet (opt-in en /notificaciones de la web) ─────────────────────────────────────
  [NOTIFICATION_TYPE.ANIMAL_NEARBY]: {
    name: "kadesh_pet_animal_cerca",
    audience: "pet",
    params: (v) => [v.status, v.animal, v.url],
  },
  [NOTIFICATION_TYPE.ANIMAL_POSSIBLE_MATCH]: {
    name: "kadesh_pet_coincidencia",
    audience: "pet",
    params: (v) => [v.summary, v.url],
  },
  [NOTIFICATION_TYPE.ANIMAL_CLAIM_REQUESTED]: {
    name: "kadesh_pet_reclamo_solicitado",
    audience: "pet",
    params: (v) => [v.claimantName, v.animalName, v.url],
  },
  [NOTIFICATION_TYPE.ANIMAL_CLAIM_APPROVED]: {
    name: "kadesh_pet_reclamo_aceptado",
    audience: "pet",
    params: (v) => [v.animalName, v.url],
  },
  [NOTIFICATION_TYPE.ANIMAL_CLAIM_REJECTED]: {
    name: "kadesh_pet_reclamo_rechazado",
    audience: "pet",
    params: (v) => [v.animalName, v.reason, v.url],
  },
  [NOTIFICATION_TYPE.ANIMAL_COMMENTED]: {
    name: "kadesh_pet_comentario",
    audience: "pet",
    params: (v) => [v.authorName, v.animalName, v.comment, v.url],
  },
  [NOTIFICATION_TYPE.PET_REMINDER_DUE]: {
    name: "kadesh_pet_recordatorio",
    audience: "pet",
    params: (v) => [v.petName, v.reminder, v.due, v.url],
  },
};

/** URL absoluta de la web de Pet (misma base que `petPublicUrl` / `petCardUrl`). Respaldo del enlace de una plantilla. */
export function petSiteUrl(path = "/notificaciones"): string {
  const base = (
    process.env.PET_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "https://pet.kadesh.com.mx"
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

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

/** Nombres de las variables que faltan para el número de Kadesh (vacío = configurado). */
function missingPlatformVars(): string[] {
  return [
    ["WHATSAPP_PLATFORM_PHONE_NUMBER_ID", process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID],
    ["WHATSAPP_PLATFORM_ACCESS_TOKEN", process.env.WHATSAPP_PLATFORM_ACCESS_TOKEN],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name as string);
}

/**
 * Una línea al arrancar para saber, desde los logs de Railway, si los avisos por WhatsApp pueden
 * salir. Ojo: el WhatsApp que se conecta en el CRM es otro (el de la empresa, guardado en la base).
 */
export function logPlatformWhatsappStatus(): void {
  const missing = missingPlatformVars();
  if (missing.length) {
    console.warn(`[notify:whatsapp] Avisos por WhatsApp APAGADOS: falta ${missing.join(" y ")}.`);
    return;
  }
  const id = process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID?.trim() ?? "";
  console.log(
    `[notify:whatsapp] Avisos por WhatsApp activos (phone number id …${id.slice(-4)}). ` +
      `Plantillas: ${Object.values(WHATSAPP_TEMPLATES).map((t) => t?.name).join(", ")}.`,
  );
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
 * Busca, entre los destinatarios de la notificación, a quien activó `whatsappNotifications`, tiene
 * teléfono y no silenció este tipo (`whatsappMutedTypes`), y les manda la plantilla. Nunca lanza:
 * lo llama `notify` sin esperar.
 * `User.phone` no es nullable en la base (vacío es `""`): filtrar con `not: null` hace fallar a Prisma.
 */
export async function sendNotificationWhatsappToOptedIn(
  prisma: any,
  recipientIds: string[],
  type: NotificationType,
  values: NotificationTemplateValues,
): Promise<void> {
  try {
    // Un tipo sin plantilla se queda solo en la campana a propósito: no se avisa en el log.
    if (!hasWhatsappTemplate(type)) return;
    if (!platformWhatsappConfig()) {
      console.warn(
        `[notify:whatsapp] ${type} no salió por WhatsApp: falta ${missingPlatformVars().join(" y ")} en el entorno.`,
      );
      return;
    }

    const candidates = await prisma.user.findMany({
      where: { id: { in: recipientIds }, whatsappNotifications: true, phone: { not: "" } },
      select: { id: true, phone: true, whatsappMutedTypes: true },
    });
    // Prisma de Keystone puede devolver el error en vez de lanzarlo.
    if (candidates instanceof Error) throw candidates;
    const optedIn = Array.isArray(candidates)
      ? candidates.filter((user: { whatsappMutedTypes?: unknown }) => wantsWhatsappType(user.whatsappMutedTypes, type))
      : [];
    if (Array.isArray(candidates) && candidates.length > 0 && optedIn.length === 0) {
      // Lo apagaron para este tipo: es su elección, no un problema.
      return;
    }
    if (optedIn.length === 0) {
      // En los avisos de Pet casi nadie lo tiene activo: registrarlo cada vez solo haría ruido.
      if (WHATSAPP_TEMPLATES[type]?.audience === "pet") return;
      const withOptIn = await prisma.user.count({
        where: { id: { in: recipientIds }, whatsappNotifications: true },
      });
      const total = recipientIds.length;
      const reason =
        typeof withOptIn !== "number"
          ? `ninguno de los ${total} destinatario(s) tiene avisos de WhatsApp activos con teléfono`
          : withOptIn === 0
            ? `ninguno de los ${total} destinatario(s) tiene activos los avisos de WhatsApp (User.whatsappNotifications)`
            : `${withOptIn} de ${total} destinatario(s) tienen activos los avisos, pero sin teléfono (User.phone)`;
      console.warn(`[notify:whatsapp] ${type} no salió por WhatsApp: ${reason}.`);
      return;
    }

    await sendNotificationWhatsapp(optedIn, type, values);
  } catch (error) {
    console.error("[notify:whatsapp] No se pudo buscar a quién mandarle:", type, error);
  }
}

export type WhatsappSendResult = {
  /** Mensajes que Meta aceptó. */
  sent: number;
  /** Envíos que Meta rechazó o que fallaron (sin contar teléfonos inválidos). */
  failed: number;
};

/**
 * Manda la plantilla del tipo a cada destinatario. Nunca lanza: un fallo de Meta no debe tocar la
 * notificación de la campana ni la operación que la disparó. En logs solo los últimos 4 dígitos.
 * Devuelve cuántos aceptó Meta y cuántos fallaron (los recordatorios lo usan para reintentar).
 */
export async function sendNotificationWhatsapp(
  recipients: Array<{ id: string; phone?: string | null }>,
  type: NotificationType,
  values: NotificationTemplateValues,
): Promise<WhatsappSendResult> {
  const result: WhatsappSendResult = { sent: 0, failed: 0 };
  try {
    const template = WHATSAPP_TEMPLATES[type];
    const config = platformWhatsappConfig();
    if (!template || !config) return result;

    const bodyParams = template.params(values).map(templateParam);

    await Promise.allSettled(
      recipients.map(async (recipient) => {
        const to = toWhatsappNumber(recipient.phone);
        if (!to) {
          console.warn(`[notify:whatsapp] ${type}: el usuario ${recipient.id} no tiene un teléfono válido.`);
          return;
        }
        try {
          const sent = await sendWhatsAppTemplateMessage({
            ...config,
            to,
            templateName: template.name,
            language: TEMPLATE_LANGUAGE,
            bodyParams,
          });
          // Meta lo aceptó. Si después no lo entrega, el webhook registra el `failed` con este id.
          result.sent += 1;
          console.log(
            `[notify:whatsapp] ${type} (${template.name}) aceptado por Meta para usuario ${recipient.id} (…${to.slice(-4)}): ${sent.id}`,
          );
        } catch (error) {
          result.failed += 1;
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
  return result;
}
