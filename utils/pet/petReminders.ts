import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import {
  PET_REMINDER_CHANNEL,
  type PetReminderChannel,
} from "../../models/Pet/constants";
import { notify } from "../notifications/notify";
import { sendPetReminderEmail } from "../helpers/sendgrid";
import { mxToday } from "../usage/dailyUsageRollup";
import { petCardUrl } from "./petCard";

export type DueReminder = {
  id: string;
  title: string;
  /** "AAAA-MM-DD" */
  dueDate: string;
  channels: string[];
  pet: { id: string; name: string };
};

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappNotifications: boolean;
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

/** Campana + push de la app (Expo). No hay plantilla de WhatsApp para este tipo, así que `notify` no la manda. */
const sendPush: ChannelSender = async (context, reminder, recipients, copy) => {
  const count = await notify(context, {
    audience: recipients.map((recipient) => recipient.id),
    product: "pet",
    type: NOTIFICATION_TYPE.PET_REMINDER_DUE,
    title: copy.title,
    body: copy.body,
    entityType: "PetReminder",
    entityId: reminder.id,
    url: petCardUrl(reminder.pet.id),
    metadata: { petId: reminder.pet.id, dueDate: reminder.dueDate },
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
        url: petCardUrl(reminder.pet.id),
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
 * TODO(whatsapp): pendiente de implementar. El número de Kadesh ya manda WhatsApp
 * (`utils/notifications/whatsapp.ts`), pero cada tipo necesita una plantilla UTILITY aprobada en
 * Meta. Para activarlo:
 *   1. Aprobar `kadesh_pet_recordatorio` en WhatsApp Manager (es_MX, variables: mascota, recordatorio, fecha).
 *   2. Agregarla a `WHATSAPP_TEMPLATES` con `NOTIFICATION_TYPE.PET_REMINDER_DUE`.
 *   3. Aquí: `sendNotificationWhatsapp(recipients.filter(r => r.whatsappNotifications && r.phone), …)`.
 *   4. Con plantilla, `notify` también la mandaría desde el canal push: agregarle a `notify` una
 *      opción para apagar WhatsApp en esa llamada. Ver docs/cartilla/README.md.
 */
const sendWhatsappChannel: ChannelSender = async (_context, reminder) => {
  console.info("[petReminder] WhatsApp pendiente de implementar (falta plantilla aprobada en Meta)", {
    reminderId: reminder.id,
  });
  return { channel: PET_REMINDER_CHANNEL.WHATSAPP, ok: false, pending: true };
};

const CHANNEL_SENDERS: Record<PetReminderChannel, ChannelSender> = {
  [PET_REMINDER_CHANNEL.PUSH]: sendPush,
  [PET_REMINDER_CHANNEL.EMAIL]: sendEmailChannel,
  [PET_REMINDER_CHANNEL.WHATSAPP]: sendWhatsappChannel,
};

/** Dueños de la mascota que pueden recibir avisos (sin cuentas suspendidas ni anonimizadas). */
async function reminderRecipients(context: KeystoneContext, petId: string): Promise<Recipient[]> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const rows = await prisma.petOwner.findMany({
    where: { petId, user: { suspendedAt: null, anonymizedAt: null } },
    select: {
      user: {
        select: { id: true, name: true, email: true, phone: true, whatsappNotifications: true },
      },
    },
  });
  if (rows instanceof Error) throw rows;
  return (rows as Array<{ user: Recipient | null }>)
    .map((row) => row.user)
    .filter((user): user is Recipient => Boolean(user?.id));
}

export async function loadDueReminder(
  context: KeystoneContext,
  reminderId: string,
): Promise<DueReminder | null> {
  const row = (await context.sudo().query.PetReminder.findOne({
    where: { id: reminderId },
    query: "id title dueDate channels pet { id name }",
  })) as (Omit<DueReminder, "channels"> & { channels: unknown }) | null;
  if (!row?.pet) return null;
  return { ...row, channels: Array.isArray(row.channels) ? (row.channels as string[]) : [] };
}

/**
 * Manda un recordatorio por cada canal elegido. `delivered` si al menos un canal llegó; `retry`
 * si nada llegó y algún canal falló al mandar (el cron lo regresa a `pending` para mañana).
 */
export async function sendReminderNotification(
  context: KeystoneContext,
  reminder: DueReminder,
): Promise<{ delivered: boolean; retry: boolean; results: ChannelResult[] }> {
  const recipients = await reminderRecipients(context, reminder.pet.id);
  if (recipients.length === 0) {
    console.warn("[petReminder] La mascota no tiene dueños a quién avisar", { reminderId: reminder.id });
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
