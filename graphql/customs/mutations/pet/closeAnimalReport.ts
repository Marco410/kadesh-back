import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { automationUserId } from "../../../../utils/notifications/animalReportAlerts";
import { addReportLog, lastReportLog } from "../../../../utils/pet/reportLogs";
import { canEditAnimalAs } from "../../../../models/Pet/Animal/Animal.access";
import {
  ANIMAL_OUTCOME,
  OUTCOME_LOG_STATUS,
  isAnimalOutcome,
  isHelpedByKadesh,
  isOutcomeChannel,
} from "../../../../models/Pet/Animal/Animal.outcome";
import { PET_STATUS } from "../../../../models/Pet/constants";

/**
 * Cerrar un caso respondiendo «¿volvió a casa?» y «¿Kadesh ayudó? ¿por dónde?». Guarda el
 * desenlace en `Animal` y deja la bitácora final (`in_family`, `adopted` o `closed`) con la misma
 * ubicación que la última, para que el pin no salte. Si el caso ya estaba cerrado, solo actualiza
 * las respuestas (y la bitácora si cambió el desenlace).
 *
 * La usan quien atiende el reporte (su autor o el equipo de su espacio de rescate) y los admins.
 * Los reportes de la automatización solo los cierra un admin.
 */
const MAX_STORY = 1000;
const MAX_NOTES = 300;

const typeDefs = `
  input CloseAnimalReportInput {
    animalId: ID!
    outcome: String!
    helpedByKadesh: String
    outcomeChannel: String
    story: String
    storyConsent: Boolean
    notes: String
  }

  type CloseAnimalReportResult {
    success: Boolean!
    message: String!
    animalSlug: String
    status: String
  }

  type Mutation {
    closeAnimalReport(input: CloseAnimalReportInput!): CloseAnimalReportResult!
  }
`;

const definition = `
  closeAnimalReport(input: CloseAnimalReportInput!): CloseAnimalReportResult!
`;

type CloseInput = {
  animalId: string;
  outcome: string;
  helpedByKadesh?: string | null;
  outcomeChannel?: string | null;
  story?: string | null;
  storyConsent?: boolean | null;
  notes?: string | null;
};

type AnimalRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  outcome?: string | null;
  closedAt?: string | null;
  user?: { id: string } | null;
  organization?: { id: string } | null;
  duplicateOf?: { id: string } | null;
  pet?: { id: string; status?: string | null } | null;
};

const DEFAULT_NOTES: Record<string, string> = {
  [ANIMAL_OUTCOME.REUNITED]: "Volvió con su familia.",
  [ANIMAL_OUTCOME.ADOPTED]: "Fue adoptado.",
  [ANIMAL_OUTCOME.OTHER_HOME]: "Encontró un hogar.",
  [ANIMAL_OUTCOME.DECEASED]: "Falleció.",
  [ANIMAL_OUTCOME.CLOSED_UNRESOLVED]: "Se cerró el caso.",
};

function fail(message: string) {
  return { success: false, message, animalSlug: null, status: null };
}

async function canClose(context: KeystoneContext, animal: AnimalRow, userId: string) {
  if (isPlatformAdmin(context.session)) return true;
  const ownerId = animal.user?.id ?? null;
  const automation = automationUserId();
  return canEditAnimalAs(
    context,
    {
      userId: ownerId && ownerId !== automation ? ownerId : null,
      organizationId: animal.organization?.id ?? null,
    },
    userId,
  );
}

const resolver = {
  closeAnimalReport: async (_root: unknown, { input }: { input: CloseInput }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para cerrar el caso.");
    if (!isAnimalOutcome(input.outcome)) return fail("Elige cómo terminó el caso.");

    const helpedByKadesh = input.helpedByKadesh == null ? null : input.helpedByKadesh;
    if (helpedByKadesh !== null && !isHelpedByKadesh(helpedByKadesh)) {
      return fail("La respuesta sobre Kadesh no es válida.");
    }
    // El canal solo tiene sentido si Kadesh ayudó.
    const outcomeChannel = helpedByKadesh === "yes" && input.outcomeChannel ? input.outcomeChannel : null;
    if (outcomeChannel !== null && !isOutcomeChannel(outcomeChannel)) {
      return fail("Elige por dónde ayudó Kadesh.");
    }
    const story = (input.story ?? "").trim().slice(0, MAX_STORY);
    const storyConsent = Boolean(story && input.storyConsent);
    const notes = (input.notes ?? "").trim().slice(0, MAX_NOTES);

    const sudo = context.sudo();
    const animal = (await sudo.query.Animal.findOne({
      where: { id: input.animalId },
      query: "id name slug outcome closedAt user { id } organization { id } duplicateOf { id } pet { id status }",
    })) as AnimalRow | null;
    if (!animal) return fail("No encontramos ese reporte.");
    if (animal.duplicateOf?.id) return fail("Este reporte está unido a otro. Ciérralo desde el reporte principal.");
    if (!(await canClose(context, animal, userId))) {
      return fail("Solo quien atiende el reporte puede cerrarlo.");
    }

    const last = await lastReportLog(context, animal.id);
    if (!last) return fail("Este reporte aún no tiene registros: agrega uno antes de cerrarlo.");

    const status = OUTCOME_LOG_STATUS[input.outcome];
    const alreadyClosed = Boolean(animal.outcome);
    const now = new Date().toISOString();

    // Primero el desenlace: así el hook de la bitácora ve el caso cerrado y no lo pisa.
    await sudo.query.Animal.updateOne({
      where: { id: animal.id },
      data: {
        outcome: input.outcome,
        helpedByKadesh,
        outcomeChannel,
        outcomeStory: story,
        storyConsent,
        closedAt: animal.closedAt ?? now,
      },
    });
    if (last.status !== status) {
      await addReportLog(context, animal.id, status, notes || DEFAULT_NOTES[input.outcome], last);
    }

    // Mascota de la cartilla reportada como perdida: vuelve a «activa» (igual que `markPetAsFound`).
    if (input.outcome === ANIMAL_OUTCOME.REUNITED && animal.pet?.id && animal.pet.status === PET_STATUS.LOST) {
      const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
      const updated = await prisma.pet.update({
        where: { id: animal.pet.id },
        data: { status: PET_STATUS.ACTIVE, lostReportId: null },
      });
      if (updated instanceof Error) {
        console.error("[closeAnimalReport] No se pudo reactivar la mascota de la cartilla", updated);
      }
    }

    void logActivity(context, {
      type: alreadyClosed ? "animal.outcome_updated" : "animal.closed",
      summary: `${alreadyClosed ? "Actualizó el cierre de" : "Cerró"} el reporte «${animal.name ?? animal.id}»`,
      entityType: "Animal",
      entityId: animal.id,
      metadata: { outcome: input.outcome, helpedByKadesh, outcomeChannel },
    });

    return {
      success: true,
      message: alreadyClosed ? "Actualizamos el cierre del caso." : "Cerraste el caso. ¡Gracias por avisar!",
      animalSlug: animal.slug ?? null,
      status,
    };
  },
};

export default { typeDefs, definition, resolver };
