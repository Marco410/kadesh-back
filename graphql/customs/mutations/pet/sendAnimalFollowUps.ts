import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../../../models/Notification/constants";
import { OPEN_CASE_STATUSES } from "../../../../models/Pet/Animal/Animal.outcome";
import { ANIMAL_DETAIL_ACTION } from "../../../../models/Pet/Animal/Animal.publishedEmail";
import {
  FOLLOW_UP_FIRST_DAYS,
  FOLLOW_UP_MIN_GAP_DAYS,
  FOLLOW_UP_SECOND_DAYS,
  INACTIVE_AFTER_DAYS,
  INACTIVE_MIN_GAP_DAYS,
  INACTIVE_UNOWNED_DAYS,
  daysAgo,
} from "../../../../models/Pet/Animal/Animal.followUp";
import { automationUserId } from "../../../../utils/notifications/animalReportAlerts";
import { notify } from "../../../../utils/notifications/notify";
import { petSiteUrl } from "../../../../utils/notifications/whatsapp";
import { sendAnimalFollowUpEmail } from "../../../../utils/helpers/sendgrid";

/**
 * Seguimiento diario de casos abiertos (ver `models/Pet/Animal/Animal.followUp.ts`):
 * 1. Recordatorio a quien atiende el reporte a la semana y a las 3 semanas sin registros: campana,
 *    push, WhatsApp (`kadesh_pet_seguimiento`, solo con opt-in) y correo. Enlaces a cerrar el caso o
 *    agregar un registro.
 * 2. Casos sin respuesta (45 días) o sin dueño a quién recordarle (30 días) dejan de salir en el
 *    mapa (`inactiveAt`). Un registro nuevo los reactiva.
 *
 * La llama .github/workflows/send-animal-follow-ups.yml con `CRON_SECRET`. Topes por corrida: lo que
 * no alcance sale al día siguiente.
 */
const MAX_REMINDERS_PER_RUN = 200;
const MAX_INACTIVE_PER_RUN = 500;

const typeDefs = `
  type SendAnimalFollowUpsResult {
    success: Boolean!
    message: String!
    reminded: Int!
    inactivated: Int!
    failed: Int!
  }
`;

const definition = `
  sendAnimalFollowUps(secret: String!): SendAnimalFollowUpsResult!
`;

type Candidate = {
  id: string;
  name: string | null;
  slug: string | null;
  stage: number;
  userId: string;
  userName: string | null;
  email: string | null;
  anonymizedAt: Date | null;
  suspendedAt: Date | null;
};

const empty = { reminded: 0, inactivated: 0, failed: 0 };

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

/**
 * Casos abiertos sin desenlace ni repetidos, con el último registro en un estatus abierto. Un
 * `LATERAL` por candidato usa el índice de `AnimalLog.animal`; los filtros indexados de `Animal`
 * (`outcome`, `inactiveAt`, `lastActivityAt`) recortan antes.
 */
async function findReminderCandidates(prisma: any, automation: string): Promise<Candidate[]> {
  const now = Date.now();
  const rows = await prisma.$queryRaw`
    SELECT a.id, a.name, a.slug, a."followUpStage" AS stage, u.id AS "userId", u.name AS "userName",
           u.email, u."anonymizedAt", u."suspendedAt"
    FROM "Animal" a
    JOIN "User" u ON u.id = a."user"
    JOIN LATERAL (
      SELECT l.status FROM "AnimalLog" l
      WHERE l."animal" = a.id
      ORDER BY l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
      LIMIT 1
    ) last ON true
    WHERE a.outcome IS NULL
      AND a."duplicateOf" IS NULL
      AND a."inactiveAt" IS NULL
      AND u.id <> ${automation}
      AND last.status = ANY(${OPEN_CASE_STATUSES}::text[])
      AND (
        (a."followUpStage" = 0 AND a."lastActivityAt" <= ${daysAgo(FOLLOW_UP_FIRST_DAYS, now)})
        OR (
          a."followUpStage" = 1
          AND a."lastActivityAt" <= ${daysAgo(FOLLOW_UP_SECOND_DAYS, now)}
          AND a."followUpSentAt" <= ${daysAgo(FOLLOW_UP_MIN_GAP_DAYS, now)}
        )
      )
    ORDER BY a."lastActivityAt" ASC
    LIMIT ${MAX_REMINDERS_PER_RUN}::int
  `;
  return unwrap<Candidate[]>(rows);
}

/** Casos que salen del mapa: sin respuesta al segundo recordatorio, o sin dueño a quién avisar. */
async function findInactiveCandidates(prisma: any, automation: string): Promise<string[]> {
  const now = Date.now();
  const rows = await prisma.$queryRaw`
    SELECT a.id
    FROM "Animal" a
    JOIN LATERAL (
      SELECT l.status FROM "AnimalLog" l
      WHERE l."animal" = a.id
      ORDER BY l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
      LIMIT 1
    ) last ON true
    WHERE a.outcome IS NULL
      AND a."duplicateOf" IS NULL
      AND a."inactiveAt" IS NULL
      AND last.status = ANY(${OPEN_CASE_STATUSES}::text[])
      AND (
        (
          a."user" IS NOT NULL AND a."user" <> ${automation}
          AND a."followUpStage" = 2
          AND a."lastActivityAt" <= ${daysAgo(INACTIVE_AFTER_DAYS, now)}
          AND a."followUpSentAt" <= ${daysAgo(INACTIVE_MIN_GAP_DAYS, now)}
        )
        OR (
          (a."user" IS NULL OR a."user" = ${automation})
          AND a."lastActivityAt" <= ${daysAgo(INACTIVE_UNOWNED_DAYS, now)}
        )
      )
    LIMIT ${MAX_INACTIVE_PER_RUN}::int
  `;
  return unwrap<Array<{ id: string }>>(rows).map((row) => row.id);
}

async function remind(context: KeystoneContext, animal: Candidate): Promise<boolean> {
  const nextStage = animal.stage + 1;
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  // Se aparta antes de mandar: si dos corridas se cruzan, solo una avisa.
  const claimed = unwrap<{ count: number }>(
    await prisma.animal.updateMany({
      where: { id: animal.id, followUpStage: animal.stage, outcome: null },
      data: { followUpStage: nextStage, followUpSentAt: new Date() },
    }),
  );
  if (claimed.count !== 1) return false;

  const name = animal.name?.trim() || "tu reporte";
  const elapsed = nextStage === 1 ? "una semana" : "3 semanas";
  const detail = `/animales/${animal.slug || animal.id}`;
  const url = petSiteUrl(detail);
  const finalNotice = nextStage === 2;

  await notify(context, {
    audience: [animal.userId],
    product: "pet",
    type: NOTIFICATION_TYPE.ANIMAL_FOLLOW_UP,
    title: `¿${name} ya volvió a casa?`,
    body: finalNotice
      ? `Van 3 semanas sin novedades. Cierra el caso si ya se resolvió o agrega un registro: si no hay novedades, dejará de salir en el mapa.`
      : `Va una semana sin novedades. Cierra el caso si ya se resolvió o agrega un registro si sigues buscando.`,
    entityType: "Animal",
    entityId: animal.id,
    url: detail,
    metadata: { stage: nextStage },
    templateValues: { animalName: name, elapsed, url },
  });

  if (animal.email && !animal.anonymizedAt && !animal.suspendedAt) {
    try {
      await sendAnimalFollowUpEmail({
        to: animal.email,
        displayName: animal.userName?.trim() || "",
        animalName: name,
        elapsed,
        closeUrl: petSiteUrl(`${detail}?accion=${ANIMAL_DETAIL_ACTION.close}`),
        addLogUrl: petSiteUrl(`${detail}?accion=${ANIMAL_DETAIL_ACTION.addLog}`),
        finalNotice,
      });
    } catch (error) {
      // La campana y el push ya salieron: no se reintenta todo por el correo.
      console.error("[followUps] No se pudo mandar el correo", { animalId: animal.id }, error);
    }
  }
  return true;
}

const resolver = {
  sendAnimalFollowUps: async (_root: unknown, { secret }: { secret: string }, context: KeystoneContext) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) {
      return { success: false, message: "No autorizado.", ...empty };
    }
    try {
      const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
      // Sin cuenta de automatización configurada, un id imposible para que la comparación no excluya a nadie.
      const automation = automationUserId() || "__sin_automatizacion__";

      let reminded = 0;
      let failed = 0;
      for (const animal of await findReminderCandidates(prisma, automation)) {
        try {
          if (await remind(context, animal)) reminded += 1;
        } catch (error) {
          failed += 1;
          console.error("[followUps] No se pudo mandar el recordatorio", { animalId: animal.id }, error);
        }
      }

      const inactiveIds = await findInactiveCandidates(prisma, automation);
      const inactivated = inactiveIds.length
        ? unwrap<{ count: number }>(
            await prisma.animal.updateMany({
              where: { id: { in: inactiveIds }, inactiveAt: null },
              data: { inactiveAt: new Date() },
            }),
          ).count
        : 0;

      return {
        success: true,
        message: `Recordatorios: ${reminded}. Casos inactivos: ${inactivated}.`,
        reminded,
        inactivated,
        failed,
      };
    } catch (error) {
      console.error("[followUps] sendAnimalFollowUps", error);
      return { success: false, message: "No se pudo completar el seguimiento.", ...empty };
    }
  },
};

export default { typeDefs, definition, resolver };
