import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import {
  PET_REMINDER_CHANNEL,
  type PetReminderChannel,
} from "../../models/Pet/constants";
import { notify } from "../notifications/notify";
import { sendNotificationWhatsapp, type NotificationTemplateValues } from "../notifications/whatsapp";
import { wantsWhatsappType } from "../../models/User/whatsappPrefs";
import { sendPetReminderEmail } from "../helpers/sendgrid";
import { mxToday } from "../usage/dailyUsageRollup";
import { RESCUE_ANIMAL_MANAGER_ROLES } from "../../models/Pet/RescueOrganization/constants";
import { petCardUrl, rescuePetCardUrl } from "./petCard";

export type DueReminder = {
  id: string;
  title: string;
  /** "AAAA-MM-DD" */
  dueDate: string;
  channels: string[];
  /** Con `organizationId` es ficha de un espacio de rescate: avisa a su equipo, no a dueños. */
  pet: { id: string; name: string; organizationId: string | null; fosterMemberId: string | null };
};

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappNotifications: boolean;
  /** Tipos que no quiere por WhatsApp (`User.whatsappMutedTypes`). */
  whatsappMutedTypes: unknown;
};

type ReminderCopy = { title: string; body: string; dateLabel: string; dueLabel: string };

type ChannelResult = {
  channel: PetReminderChannel;
  ok: boolean;
  /** El canal todavía no existe: no cuenta como fallo ni se reintenta. */
  pending?: boolean;
  /** Falló al mandar (Meta, Mailtrap…): vale la pena reintentar mañana. */
  error?: boolean;
};

type ChannelSender = (
  context: KeystoneContext,
  reminder: DueReminder,
  recipients: Recipient[],
  copy: ReminderCopy,
) => Promise<ChannelResult>;

/** La cartilla de la familia o, si es ficha de un espacio de rescate, la ficha en su panel. */
function reminderUrl(reminder: DueReminder): string {
  return reminder.pet.organizationId
    ? rescuePetCardUrl(reminder.pet.organizationId, reminder.pet.id)
    : petCardUrl(reminder.pet.id);
}

const DATE_LABEL = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

function reminderCopy(reminder: DueReminder, today: string): ReminderCopy {
  const due = new Date(`${reminder.dueDate}T00:00:00Z`);
  const days = Math.round((due.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  const dateLabel = DATE_LABEL.format(due);
  const dueLabel =
    days === 0
      ? "vence hoy"
      : days === 1
        ? "vence mañana"
        : days > 1
          ? `vence el ${dateLabel}`
          : `venció el ${dateLabel}`;
  return {
    title: `${reminder.pet.name}: ${reminder.title}`,
    body: `${reminder.title.charAt(0).toUpperCase()}${reminder.title.slice(1)} ${dueLabel}.`,
    dateLabel,
    dueLabel,
  };
}

/** Variables de `kadesh_pet_recordatorio`: «{petName} tiene pendiente «{reminder}», que {due}. … {url}». */
function reminderTemplateValues(reminder: DueReminder, copy: ReminderCopy): NotificationTemplateValues {
  return {
    petName: reminder.pet.name,
    reminder: reminder.title,
    due: copy.dueLabel,
    url: reminderUrl(reminder),
  };
}

/**
 * Campana + push de la app (Expo) y, por `notify`, WhatsApp a los dueños que activaron
 * `whatsappNotifications` (plantilla `kadesh_pet_recordatorio`).
 */
const sendPush: ChannelSender = async (context, reminder, recipients, copy) => {
  const count = await notify(context, {
    audience: recipients.map((recipient) => recipient.id),
    product: "pet",
    type: NOTIFICATION_TYPE.PET_REMINDER_DUE,
    title: copy.title,
    body: copy.body,
    entityType: "PetReminder",
    entityId: reminder.id,
    url: reminderUrl(reminder),
    metadata: { petId: reminder.pet.id, dueDate: reminder.dueDate },
    templateValues: reminderTemplateValues(reminder, copy),
  });
  // `notify` nunca lanza: 0 filas = no se pudo guardar.
  return { channel: PET_REMINDER_CHANNEL.PUSH, ok: count > 0, error: count === 0 };
};

const sendEmailChannel: ChannelSender = async (_context, reminder, recipients, copy) => {
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    try {
      await sendPetReminderEmail({
        to: recipient.email,
        displayName: recipient.name || "Hola",
        petName: reminder.pet.name,
        title: reminder.title,
        dateLabel: copy.dateLabel,
        dueLabel: copy.dueLabel,
        url: reminderUrl(reminder),
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[petReminder] No se pudo mandar el correo", { reminderId: reminder.id }, error);
    }
  }
  return { channel: PET_REMINDER_CHANNEL.EMAIL, ok: sent > 0, error: sent === 0 && failed > 0 };
};

/**
 * Canal `whatsapp` explícito. El WhatsApp de un recordatorio sale con el canal `push` (vía
 * `notify`) a quien activó `whatsappNotifications`; si el recordatorio también trae `push`, aquí no
 * se manda otra vez (llegaría doble). Sin `push`, se manda directo a los dueños con el opt-in y
 * teléfono. Nadie con WhatsApp activo no es un fallo: no se reintenta.
 */
const sendWhatsappChannel: ChannelSender = async (_context, reminder, recipients, copy) => {
  if (reminder.channels.includes(PET_REMINDER_CHANNEL.PUSH)) {
    return { channel: PET_REMINDER_CHANNEL.WHATSAPP, ok: false, pending: true };
  }
  const optedIn = recipients.filter(
    (recipient) =>
      recipient.whatsappNotifications &&
      recipient.phone?.trim() &&
      wantsWhatsappType(recipient.whatsappMutedTypes, NOTIFICATION_TYPE.PET_REMINDER_DUE),
  );
  if (optedIn.length === 0) {
    return { channel: PET_REMINDER_CHANNEL.WHATSAPP, ok: false, pending: true };
  }
  const { sent, failed } = await sendNotificationWhatsapp(
    optedIn,
    NOTIFICATION_TYPE.PET_REMINDER_DUE,
    reminderTemplateValues(reminder, copy),
  );
  return { channel: PET_REMINDER_CHANNEL.WHATSAPP, ok: sent > 0, error: sent === 0 && failed > 0 };
};

const CHANNEL_SENDERS: Record<PetReminderChannel, ChannelSender> = {
  [PET_REMINDER_CHANNEL.PUSH]: sendPush,
  [PET_REMINDER_CHANNEL.EMAIL]: sendEmailChannel,
  [PET_REMINDER_CHANNEL.WHATSAPP]: sendWhatsappChannel,
};

const RECIPIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  whatsappNotifications: true,
  whatsappMutedTypes: true,
};
/** Sin cuentas suspendidas ni anonimizadas. */
const ACTIVE_USER = { suspendedAt: null, anonymizedAt: null };

/**
 * A quién se avisa: los dueños de la mascota o, si es ficha de un espacio de rescate, admin y
 * coordinación del espacio y quien la tiene en su hogar temporal.
 */
async function reminderRecipients(context: KeystoneContext, pet: DueReminder["pet"]): Promise<Recipient[]> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const rows = pet.organizationId
    ? await prisma.rescueOrganizationMember.findMany({
        where: {
          user: ACTIVE_USER,
          OR: [
            { organizationId: pet.organizationId, role: { in: RESCUE_ANIMAL_MANAGER_ROLES } },
            ...(pet.fosterMemberId ? [{ id: pet.fosterMemberId }] : []),
          ],
        },
        select: { user: { select: RECIPIENT_SELECT } },
      })
    : await prisma.petOwner.findMany({
        where: { petId: pet.id, user: ACTIVE_USER },
        select: { user: { select: RECIPIENT_SELECT } },
      });
  if (rows instanceof Error) throw rows;
  const byId = new Map<string, Recipient>();
  for (const row of rows as Array<{ user: Recipient | null }>) {
    if (row.user?.id) byId.set(row.user.id, row.user);
  }
  return [...byId.values()];
}

export async function loadDueReminder(
  context: KeystoneContext,
  reminderId: string,
): Promise<DueReminder | null> {
  const row = (await context.sudo().query.PetReminder.findOne({
    where: { id: reminderId },
    query: "id title dueDate channels pet { id name organization { id } fosterMember { id } }",
  })) as
    | (Omit<DueReminder, "channels" | "pet"> & {
        channels: unknown;
        pet:
          | { id: string; name: string; organization?: { id: string } | null; fosterMember?: { id: string } | null }
          | null;
      })
    | null;
  if (!row?.pet) return null;
  return {
    ...row,
    pet: {
      id: row.pet.id,
      name: row.pet.name,
      organizationId: row.pet.organization?.id ?? null,
      fosterMemberId: row.pet.fosterMember?.id ?? null,
    },
    channels: Array.isArray(row.channels) ? (row.channels as string[]) : [],
  };
}

/**
 * Manda un recordatorio por cada canal elegido. `delivered` si al menos un canal llegó; `retry`
 * si nada llegó y algún canal falló al mandar (el cron lo regresa a `pending` para mañana).
 */
export async function sendReminderNotification(
  context: KeystoneContext,
  reminder: DueReminder,
): Promise<{ delivered: boolean; retry: boolean; results: ChannelResult[] }> {
  const recipients = await reminderRecipients(context, reminder.pet);
  if (recipients.length === 0) {
    console.warn("[petReminder] La mascota no tiene a quién avisar (dueños o equipo)", { reminderId: reminder.id });
    return { delivered: false, retry: false, results: [] };
  }

  const copy = reminderCopy(reminder, mxToday());
  const channels = [...new Set(reminder.channels)].filter(
    (channel): channel is PetReminderChannel => channel in CHANNEL_SENDERS,
  );
  const results: ChannelResult[] = [];
  for (const channel of channels) {
    try {
      results.push(await CHANNEL_SENDERS[channel](context, reminder, recipients, copy));
    } catch (error) {
      console.error("[petReminder] Falló el canal", channel, { reminderId: reminder.id }, error);
      results.push({ channel, ok: false, error: true });
    }
  }
  const delivered = results.some((result) => result.ok);
  return { delivered, retry: !delivered && results.some((result) => result.error), results };
}
