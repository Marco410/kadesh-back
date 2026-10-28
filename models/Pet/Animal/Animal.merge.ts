import type { KeystoneContext } from "@keystone-6/core/types";
import { logActivity } from "../../../utils/activity/logActivity";
import {
  notifyAnimalMerged,
  notifyClaimResolved,
} from "../../../utils/notifications/animalReportAlerts";
import { ANIMAL_CLAIM_STATUS } from "./AnimalClaim/constants";
import { ANIMAL_COMMENT_KIND } from "./AnimalComment/constants";

/**
 * Unir reportes repetidos: un admin pone `duplicateOf` en el repetido (Admin UI). La ficha del
 * repetido redirige al principal (web), deja de salir en listados y sus comentarios, favoritos y
 * repetidos que apuntaban a él pasan al principal.
 */

type AnimalRef = {
  id: string;
  name?: string | null;
  slug?: string | null;
  user?: { id: string; name?: string | null } | null;
};

export async function validateDuplicateOf({
  operation,
  resolvedData,
  item,
  context,
  addValidationError,
}: {
  operation: string;
  resolvedData: Record<string, any>;
  item?: { id?: string } | null;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}) {
  const mainId: string | undefined = resolvedData.duplicateOf?.connect?.id;
  if (!mainId) return;
  if (operation === "update" && item?.id === mainId) {
    return addValidationError("Un reporte no puede ser repetido de sí mismo.");
  }
  const main = (await context.sudo().query.Animal.findOne({
    where: { id: mainId },
    query: "id duplicateOf { id }",
  })) as { id: string; duplicateOf?: { id: string } | null } | null;
  if (!main) return addValidationError("No encontramos el reporte principal.");
  if (main.duplicateOf) {
    addValidationError("Ese reporte ya está unido a otro. Elige el reporte principal.");
  }
}

export async function mergeAnimalReport(
  context: KeystoneContext,
  { duplicateId, mainId }: { duplicateId: string; mainId: string },
): Promise<void> {
  const sudo = context.sudo();
  const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
  const [duplicate, main] = (await Promise.all([
    sudo.query.Animal.findOne({ where: { id: duplicateId }, query: "id name slug user { id name }" }),
    sudo.query.Animal.findOne({ where: { id: mainId }, query: "id name slug user { id name }" }),
  ])) as [AnimalRef | null, AnimalRef | null];
  if (!duplicate || !main) return;

  // Prisma de Keystone devuelve el error en vez de lanzarlo.
  const comments = await prisma.animalComment.updateMany({
    where: { animalId: duplicateId },
    data: { animalId: mainId },
  });
  if (comments instanceof Error) throw comments;

  const favorites = await prisma.animalFavorite.findMany({
    where: { animalId: { in: [duplicateId, mainId] } },
    select: { id: true, userId: true, animalId: true },
  });
  if (favorites instanceof Error) throw favorites;
  const mainFans = new Set(
    (favorites as Array<{ userId: string | null; animalId: string }>)
      .filter((row) => row.animalId === mainId)
      .map((row) => row.userId),
  );
  const repeated = (favorites as Array<{ id: string; userId: string | null; animalId: string }>).filter(
    (row) => row.animalId === duplicateId && mainFans.has(row.userId),
  );
  if (repeated.length) {
    await prisma.animalFavorite.deleteMany({ where: { id: { in: repeated.map((row) => row.id) } } });
  }
  await prisma.animalFavorite.updateMany({
    where: { animalId: duplicateId },
    data: { animalId: mainId },
  });

  // Sin cadenas: los repetidos de este repetido apuntan ahora al principal.
  await prisma.animal.updateMany({
    where: { duplicateOfId: duplicateId },
    data: { duplicateOfId: mainId },
  });

  const reason = "El reporte se unió con otro del mismo animal.";
  const pendingClaims = (await sudo.query.AnimalClaim.findMany({
    where: {
      animal: { id: { equals: duplicateId } },
      status: { equals: ANIMAL_CLAIM_STATUS.PENDING },
    },
    query: "id claimant { id }",
  })) as Array<{ id: string; claimant?: { id: string } | null }>;
  for (const claim of pendingClaims) {
    await sudo.query.AnimalClaim.updateOne({
      where: { id: claim.id },
      data: {
        status: ANIMAL_CLAIM_STATUS.REJECTED,
        rejectReason: reason,
        resolvedAt: new Date().toISOString(),
      },
    });
    if (claim.claimant?.id) {
      void notifyClaimResolved(context, {
        claimantId: claim.claimant.id,
        animal: main,
        approved: false,
        reason: `${reason} Si es tu mascota, reclama el reporte principal.`,
      });
    }
  }

  const sameReporter = duplicate.user?.id && duplicate.user.id === main.user?.id;
  if (duplicate.user?.id && !sameReporter) {
    // Queda en la ficha principal a nombre de quien hizo el repetido (y avisa a quien la atiende).
    await sudo.query.AnimalComment.createOne({
      data: {
        comment: "Se unió aquí otro reporte de este animal. Sus comentarios ya están en esta ficha.",
        kind: ANIMAL_COMMENT_KIND.DUPLICATE_REPORT,
        animal: { connect: { id: mainId } },
        user: { connect: { id: duplicate.user.id } },
      },
    });
    void notifyAnimalMerged(context, {
      userId: duplicate.user.id,
      duplicateName: duplicate.name ?? null,
      main,
    });
  }

  void logActivity(context, {
    type: "admin.animal_merged",
    summary: `Unió el reporte «${duplicate.name ?? duplicateId}» con «${main.name ?? mainId}»`,
    entityType: "Animal",
    entityId: duplicateId,
    metadata: { mainId, movedComments: comments?.count ?? 0 },
  });
}

/** Al poner `duplicateOf` (de vacío a un reporte), une el repetido con el principal. */
export const animalMergeAfterOperation = async ({
  operation,
  item,
  originalItem,
  context,
}: {
  operation: string;
  item: any;
  originalItem?: any;
  context: KeystoneContext;
}) => {
  if (operation !== "update" || !item?.id) return;
  const mainId: string | null = item.duplicateOfId ?? null;
  const before: string | null = originalItem?.duplicateOfId ?? null;
  if (!mainId || mainId === before) return;
  try {
    await mergeAnimalReport(context, { duplicateId: String(item.id), mainId });
  } catch (error) {
    console.error("[animal] No se pudo unir el reporte repetido:", item.id, error);
  }
};
