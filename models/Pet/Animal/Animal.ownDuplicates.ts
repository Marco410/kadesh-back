import type { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { isSudoContext } from "../../../utils/activity/listActivityHooks";
import { logActivity } from "../../../utils/activity/logActivity";
import { petPublicUrl } from "../../../utils/pet/animalReport";
import {
  CLOSED_STATUSES,
  SIMILARITY_WINDOW_DAYS,
  compareNames,
  foldText,
} from "../../../utils/pet/reportSimilarity";

/**
 * La misma persona publicando otra vez el mismo animal. La web y la app crean el reporte en tres
 * pasos (animal → bitácora → fotos); si uno falla y reintentan, antes quedaba otro animal. Aquí:
 * - si ya tiene ese reporte completo (con bitácora), `createAnimal` no la deja publicar otro;
 * - si quedó uno a medias (sin bitácora, fotos ni nada encima), se borra al crear el nuevo.
 * Solo para personas (sin sudo y sin admin): la automatización y Operaciones no pasan por aquí.
 * Reportes de distintas personas del mismo animal no se frenan: eso es el aviso de parecidos.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Con nombre genérico («Sin nombre») solo cuenta si es casi al mismo tiempo. */
const GENERIC_NAME_WINDOW_MS = DAY_MS;

type ReportFields = {
  userId: string;
  animalTypeId: string;
  name?: string | null;
  contactNumber?: string | null;
  description?: string | null;
};

type OwnReport = {
  id: string;
  name: string | null;
  slug: string | null;
  createdAt: string | null;
  logsCount: number;
  multimediaCount: number;
};

type CandidateRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  contactNumber?: string | null;
  physical_description?: string | null;
  createdAt?: string | null;
  logsCount?: number | null;
  multimediaCount?: number | null;
  pet?: { id: string } | null;
  logs?: Array<{ status?: string | null }> | null;
};

function relationId(value: unknown): string | null {
  const id = (value as { connect?: { id?: unknown } } | null | undefined)?.connect?.id;
  return typeof id === "string" && id ? id : null;
}

function isSameReport(input: ReportFields, row: CandidateRow, now: number) {
  const names = compareNames(input.name, row.name);
  if (names === "same" || names === "similar") return true;
  if (names !== null) return false;
  // Nombre genérico: un rescatista puede subir varios «Sin nombre» distintos. Solo cuenta si es
  // el mismo teléfono, la misma descripción y casi al mismo tiempo (un reintento).
  const created = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
  if (!Number.isFinite(created) || now - created > GENERIC_NAME_WINDOW_MS) return false;
  const phone = (input.contactNumber ?? "").trim();
  const description = foldText(input.description);
  return (
    Boolean(phone) &&
    phone === (row.contactNumber ?? "").trim() &&
    Boolean(description) &&
    description === foldText(row.physical_description)
  );
}

/** Reportes de la persona que parecen el mismo animal, del más nuevo al más viejo. */
export async function findOwnRepeatedReports(
  context: KeystoneContext,
  input: ReportFields & { excludeId?: string | null },
): Promise<OwnReport[]> {
  const now = Date.now();
  const since = new Date(now - SIMILARITY_WINDOW_DAYS.lost * DAY_MS).toISOString();
  const rows = (await context.sudo().query.Animal.findMany({
    where: {
      user: { id: { equals: input.userId } },
      animal_type: { id: { equals: input.animalTypeId } },
      duplicateOf: null,
      createdAt: { gte: since },
      ...(input.excludeId ? { id: { not: { equals: input.excludeId } } } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    query: `
      id name slug contactNumber physical_description createdAt logsCount multimediaCount
      pet { id }
      logs(orderBy: [{ date_status: desc }, { createdAt: desc }], take: 1) { status }
    `,
  })) as CandidateRow[];

  return rows
    .filter((row) => !CLOSED_STATUSES.has((row.logs?.[0]?.status ?? "").toLowerCase()))
    .filter((row) => !row.pet)
    .filter((row) => isSameReport(input, row, now))
    .map((row) => ({
      id: row.id,
      name: row.name ?? null,
      slug: row.slug ?? null,
      createdAt: row.createdAt ?? null,
      logsCount: row.logsCount ?? 0,
      multimediaCount: row.multimediaCount ?? 0,
    }));
}

function appliesTo(context: KeystoneContext) {
  return !isSudoContext(context) && !isPlatformAdmin(context.session);
}

/** `validateInput` de `Animal`: no deja publicar de nuevo un reporte que ya está completo. */
export async function validateOwnDuplicate({
  operation,
  resolvedData,
  context,
  addValidationError,
}: {
  operation: string;
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}): Promise<void> {
  if (operation !== "create" || !appliesTo(context)) return;
  const userId = relationId(resolvedData.user);
  const animalTypeId = relationId(resolvedData.animal_type);
  if (!userId || !animalTypeId) return;

  try {
    const repeated = await findOwnRepeatedReports(context, {
      userId,
      animalTypeId,
      name: resolvedData.name,
      contactNumber: resolvedData.contactNumber,
      description: resolvedData.physical_description,
    });
    const complete = repeated.find((report) => report.logsCount > 0);
    if (!complete) return;
    const name = complete.name?.trim() || "este animal";
    const url = petPublicUrl(complete.slug || complete.id);
    addValidationError(
      `Ya publicaste a ${name}. Si te faltó algo, agrégalo en tu reporte: ${url}`,
    );
  } catch (error) {
    // Si la revisión falla, no se frena la publicación.
    console.error("[animal] no se pudo revisar si el reporte ya existía:", error);
  }
}

/** ¿Algo más cuelga del reporte? Entonces no se borra aunque esté a medias. */
async function hasDependents(context: KeystoneContext, animalId: string) {
  const sudo = context.sudo();
  const where = { animal: { id: { equals: animalId } } };
  const [comments, claims, favorites, pets, merged] = await Promise.all([
    sudo.query.AnimalComment.count({ where }),
    sudo.query.AnimalClaim.count({ where }),
    sudo.query.AnimalFavorite.count({ where }),
    sudo.query.Pet.count({ where: { lostReport: { id: { equals: animalId } } } }),
    sudo.query.Animal.count({ where: { duplicateOf: { id: { equals: animalId } } } }),
  ]);
  return comments + claims + favorites + pets + merged > 0;
}

/**
 * `afterOperation` de `Animal` al crear: borra los reportes a medias de la misma persona (un
 * intento anterior que falló después de crear el animal). Nunca lanza.
 */
export async function removeIncompleteOwnReports({
  operation,
  item,
  context,
}: {
  operation: string;
  item: any;
  context: KeystoneContext;
}): Promise<void> {
  if (operation !== "create" || !item?.id || !appliesTo(context)) return;
  const userId = typeof item.userId === "string" ? item.userId : null;
  const animalTypeId = typeof item.animal_typeId === "string" ? item.animal_typeId : null;
  if (!userId || !animalTypeId) return;

  try {
    const newId = String(item.id);
    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
    const repeated = await findOwnRepeatedReports(context, {
      userId,
      animalTypeId,
      name: item.name,
      contactNumber: item.contactNumber,
      description: item.physical_description,
      excludeId: newId,
    });
    const incomplete = repeated.filter((report) => {
      if (report.logsCount > 0 || report.multimediaCount > 0) return false;
      const time = report.createdAt ? new Date(report.createdAt).getTime() : NaN;
      return Number.isFinite(time) && time <= createdAt;
    });

    for (const report of incomplete) {
      if (await hasDependents(context, report.id)) continue;
      await context.sudo().query.Animal.deleteOne({ where: { id: report.id } });
      console.log(
        `[animal] se borró el reporte a medias ${report.id} («${report.name ?? ""}»): se publicó de nuevo como ${newId}`,
      );
      void logActivity(context, {
        type: "pet.incomplete_report_removed",
        summary: `Se borró un reporte a medias de «${report.name ?? report.id}» al publicarlo de nuevo`,
        entityType: "Animal",
        entityId: report.id,
        metadata: { replacedBy: newId },
      });
    }
  } catch (error) {
    console.error("[animal] no se pudieron limpiar reportes a medias:", error);
  }
}
