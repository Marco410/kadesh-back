import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { PET_EVENT_ALERTS, PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import {
  eventPlaceText,
  formatEventWhen,
  loadPetEventForNotice,
  petEventUrl,
  relativeEventDay,
} from "../../../../../utils/notifications/eventAlerts";
import { notify } from "../../../../../utils/notifications/notify";
import { prismaOf, sendZoneAlertsIfDue } from "./shared";

/** Topes por corrida; lo que no alcance sale en la siguiente (cada hora). */
const MAX_REMINDERS_PER_RUN = 500;
const MAX_ZONE_EVENTS_PER_RUN = 50;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const typeDefs = `
  type SendPetEventNotificationsResult {
    success: Boolean!
    message: String!
    "Personas a las que se les mandó recordatorio"
    reminders: Int!
    "Eventos que avisaron a su zona en esta corrida"
    zoneEvents: Int!
    "Personas avisadas por esos eventos"
    zoneRecipients: Int!
  }
`;

const definition = `
  sendPetEventNotifications(secret: String!): SendPetEventNotificationsResult!
`;

type ReminderRow = { id: string; userId: string; eventId: string; sessionId: string; startsAt: Date };

async function sendReminders(context: KeystoneContext, now: Date): Promise<number> {
  const prisma = prismaOf(context);
  const until = new Date(now.getTime() + PET_EVENT_ALERTS.REMINDER_HOURS * HOUR_MS);
  const rows = await prisma.$queryRaw`
    SELECT i.id, i."user" AS "userId", e.id AS "eventId", s.id AS "sessionId", s."startsAt" AS "startsAt"
    FROM "PetEventInterest" i
    JOIN "PetEvent" e ON e.id = i.event
    JOIN LATERAL (
      SELECT s.id, s."startsAt" FROM "PetEventSession" s
      WHERE s.event = e.id AND s."startsAt" > ${now} AND s."startsAt" <= ${until}
      ORDER BY s."startsAt" ASC
      LIMIT 1
    ) s ON true
    WHERE e.status = ${PET_EVENT_STATUS.APPROVED}
      AND i."user" IS NOT NULL
      AND (i."lastRemindedSessionId" IS NULL OR i."lastRemindedSessionId" <> s.id)
    ORDER BY s."startsAt" ASC
    LIMIT ${MAX_REMINDERS_PER_RUN}::int
  `;
  if (rows instanceof Error) throw rows;

  const groups = new Map<string, ReminderRow[]>();
  for (const row of rows as ReminderRow[]) {
    const key = `${row.eventId}:${row.sessionId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let sent = 0;
  for (const group of groups.values()) {
    const { eventId, sessionId } = group[0];
    const startsAt = new Date(group[0].startsAt);
    // Se aparta antes de mandar: si dos corridas se cruzan, solo una lo manda.
    const audience: string[] = [];
    for (const row of group) {
      const claimed = await prisma.petEventInterest.updateMany({
        where: {
          id: row.id,
          OR: [{ lastRemindedSessionId: null }, { lastRemindedSessionId: { not: sessionId } }],
        },
        data: { lastRemindedSessionId: sessionId },
      });
      if (claimed instanceof Error) throw claimed;
      if (claimed.count === 1) audience.push(row.userId);
    }
    if (audience.length === 0) continue;

    const event = await loadPetEventForNotice(context, eventId, now);
    if (!event) continue;
    const day = relativeEventDay(startsAt, event.timeZone, now) ?? "Pronto";
    sent += await notify(context, {
      audience,
      product: "pet",
      type: NOTIFICATION_TYPE.EVENT_REMINDER,
      title: `${day}: ${event.title}`,
      body: [formatEventWhen(startsAt, event.timeZone), eventPlaceText(event)].filter(Boolean).join(" · "),
      entityType: "PetEvent",
      entityId: event.id,
      url: petEventUrl(event.slug),
      metadata: { slug: event.slug, sessionId },
    });
  }
  return sent;
}

async function sendDueZoneAlerts(context: KeystoneContext, now: Date): Promise<{ events: number; recipients: number }> {
  const prisma = prismaOf(context);
  const leadUntil = new Date(now.getTime() + PET_EVENT_ALERTS.LEAD_DAYS * DAY_MS);
  const rows = await prisma.$queryRaw`
    SELECT e.id
    FROM "PetEvent" e
    WHERE e.status = ${PET_EVENT_STATUS.APPROVED}
      AND e."zoneAlertsSentAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "PetEventSession" s
        WHERE s.event = e.id AND s."endsAt" >= ${now} AND s."startsAt" <= ${leadUntil}
      )
    ORDER BY e."firstStartsAt" ASC
    LIMIT ${MAX_ZONE_EVENTS_PER_RUN}::int
  `;
  if (rows instanceof Error) throw rows;
  let events = 0;
  let recipients = 0;
  for (const { id } of rows as Array<{ id: string }>) {
    const sent = await sendZoneAlertsIfDue(context, id, now);
    if (sent === null) continue;
    events += 1;
    recipients += sent;
  }
  return { events, recipients };
}

const resolver = {
  /**
   * La llama cada hora .github/workflows/send-pet-event-notifications.yml con `CRON_SECRET`:
   * (a) recordatorios de fechas que empiezan en las próximas 24 h, una vez por fecha y persona;
   * (b) avisos a la zona de eventos aprobados cuya próxima fecha ya está a 14 días o menos.
   */
  sendPetEventNotifications: async (_root: unknown, { secret }: { secret: string }, context: KeystoneContext) => {
    const empty = { reminders: 0, zoneEvents: 0, zoneRecipients: 0 };
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) return { success: false, message: "No autorizado.", ...empty };
    try {
      const now = new Date();
      const reminders = await sendReminders(context, now);
      const zone = await sendDueZoneAlerts(context, now);
      return {
        success: true,
        message: `Eventos: ${reminders} recordatorios; ${zone.events} eventos avisaron a ${zone.recipients} personas de su zona.`,
        reminders,
        zoneEvents: zone.events,
        zoneRecipients: zone.recipients,
      };
    } catch (error) {
      console.error("[sendPetEventNotifications]", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "No se pudieron mandar los avisos de eventos.",
        ...empty,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
