import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_REMINDER_STATUS, PET_STATUS } from "../../../../../models/Pet/constants";
import { loadDueReminder, sendReminderNotification } from "../../../../../utils/pet/petReminders";
import { mxToday } from "../../../../../utils/usage/dailyUsageRollup";

/** Tope por corrida; lo que no alcance sale en la siguiente. */
const MAX_PER_RUN = 500;

const typeDefs = `
  type SendDuePetRemindersResult {
    success: Boolean!
    message: String!
    processed: Int!
    sent: Int!
    failed: Int!
  }
`;

const definition = `
  sendDuePetReminders(secret: String!): SendDuePetRemindersResult!
`;

const empty = { processed: 0, sent: 0, failed: 0 };

const resolver = {
  /**
   * Manda los `PetReminder` pendientes cuya fecha de aviso (`dueDate - notifyDaysBefore`) ya llegó
   * (hoy en CDMX o antes). La llama un cron diario (.github/workflows/send-pet-reminders.yml) con
   * `CRON_SECRET`, igual que rollupDailyUsage.
   */
  sendDuePetReminders: async (_root: unknown, { secret }: { secret: string }, context: KeystoneContext) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) {
      return { success: false, message: "No autorizado.", ...empty };
    }
    try {
      const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
      const today = mxToday();
      const rows = await prisma.$queryRaw`
        SELECT r.id
        FROM "PetReminder" r
        JOIN "Pet" p ON p.id = r.pet
        WHERE r.status = ${PET_REMINDER_STATUS.PENDING}
          AND (r."dueDate" - r."notifyDaysBefore") <= ${today}::date
          AND p.status IN (${PET_STATUS.ACTIVE}, ${PET_STATUS.LOST})
        ORDER BY r."dueDate" ASC
        LIMIT ${MAX_PER_RUN}::int
      `;
      if (rows instanceof Error) throw rows;

      let sent = 0;
      let failed = 0;
      for (const { id } of rows as Array<{ id: string }>) {
        // Se aparta antes de mandar: si dos corridas se cruzan, solo una lo manda.
        const claimed = await prisma.petReminder.updateMany({
          where: { id, status: PET_REMINDER_STATUS.PENDING },
          data: { status: PET_REMINDER_STATUS.SENT, sentAt: new Date() },
        });
        if (claimed instanceof Error) throw claimed;
        if (claimed.count !== 1) continue;

        const reminder = await loadDueReminder(context, id);
        const outcome = reminder
          ? await sendReminderNotification(context, reminder)
          : { delivered: false, retry: false };
        if (outcome.delivered) {
          sent += 1;
          continue;
        }
        failed += 1;
        if (outcome.retry) {
          await prisma.petReminder.updateMany({
            where: { id, status: PET_REMINDER_STATUS.SENT },
            data: { status: PET_REMINDER_STATUS.PENDING, sentAt: null },
          });
        }
      }

      const processed = (rows as unknown[]).length;
      return {
        success: true,
        message: `Recordatorios del ${today}: ${sent} enviados, ${failed} sin entregar.`,
        processed,
        sent,
        failed,
      };
    } catch (error) {
      console.error("[sendDuePetReminders]", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "No se pudieron mandar los recordatorios.",
        ...empty,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
