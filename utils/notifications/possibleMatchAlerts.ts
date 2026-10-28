import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { findSimilarReports } from "../pet/animalReport";
import { isGenericName } from "../pet/reportSimilarity";
import { reportAudience } from "./animalReportAlerts";
import { notify } from "./notify";

/** Máximo de reportes del otro lado que se avisan por cada reporte nuevo. */
const MAX_MATCH_ALERTS = 3;

export type PossibleMatchInput = {
  animalId: string;
  /** Quien reportó el nuevo: no se avisa a sí mismo. */
  ownerId?: string | null;
  slug?: string | null;
  url?: string | null;
  status?: string | null;
  lat: number;
  lng: number;
  date?: string | null;
};

/**
 * Con el primer registro de un perdido o encontrado, busca reportes del otro lado de la historia
 * (perdido ↔ encontrado) muy parecidos y avisa a quien los atiende: «reportaron uno encontrado
 * parecido a Chaneque». Un aviso por reporte y destinatario. Nunca lanza.
 */
export async function notifyPossibleMatches(context: KeystoneContext, input: PossibleMatchInput): Promise<number> {
  try {
    const status = (input.status ?? "").toLowerCase();
    if (!["lost", "found", "rescued", "abandoned"].includes(status)) return 0;
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return 0;

    const sudo = context.sudo();
    const animal = (await sudo.query.Animal.findOne({
      where: { id: input.animalId },
      query: "id name sex color physical_description animal_type { id } animal_breed { id }",
    })) as {
      id: string;
      name?: string | null;
      sex?: string | null;
      color?: string | null;
      physical_description?: string | null;
      animal_type?: { id: string } | null;
      animal_breed?: { id: string } | null;
    } | null;
    if (!animal?.animal_type?.id) return 0;

    const matches = (
      await findSimilarReports(context, {
        animalTypeId: animal.animal_type.id,
        name: animal.name,
        lat: input.lat,
        lng: input.lng,
        status,
        sex: animal.sex,
        color: animal.color,
        breedId: animal.animal_breed?.id,
        description: animal.physical_description,
        lostDate: input.date,
        excludeAnimalId: animal.id,
        kinds: ["match"],
      })
    )
      .filter((match) => match.level === "likely")
      .slice(0, MAX_MATCH_ALERTS);
    if (!matches.length) return 0;

    const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
    const newIsLost = status === "lost";
    let sent = 0;
    for (const match of matches) {
      const audience = reportAudience(match.userId);
      if (Array.isArray(audience) && input.ownerId && audience.includes(input.ownerId)) continue;
      if (Array.isArray(audience)) {
        const already = await prisma.notification.findFirst({
          where: {
            recipientId: audience[0],
            type: NOTIFICATION_TYPE.ANIMAL_POSSIBLE_MATCH,
            entityId: animal.id,
          },
          select: { id: true },
        });
        if (already && !(already instanceof Error)) continue;
      }
      const theirName = isGenericName(match.name) ? null : match.name;
      sent += await notify(context, {
        audience,
        product: "pet",
        type: NOTIFICATION_TYPE.ANIMAL_POSSIBLE_MATCH,
        title: newIsLost
          ? `Una familia busca a un animal parecido ${theirName ? `a ${theirName}` : "al que reportaste"}`
          : `Reportaron uno encontrado parecido a ${theirName ?? "tu mascota"}`,
        body: newIsLost
          ? "Lo reportaron perdido cerca de donde lo encontraron. Revisa las fotos y si es el mismo."
          : "Lo encontraron cerca de donde se perdió. Revisa las fotos y, si es, contacta a quien lo reportó.",
        entityType: "Animal",
        entityId: animal.id,
        url: input.url ?? null,
        metadata: { slug: input.slug ?? null, matchOf: match.id, score: match.score },
      });
    }
    return sent;
  } catch (error) {
    console.error("[alerts] No se pudo avisar de posibles coincidencias:", input.animalId, error);
    return 0;
  }
}
