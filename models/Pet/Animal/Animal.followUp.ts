import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Seguimiento de casos abiertos: recordatorios a quien atiende el reporte y casos inactivos.
 *
 * - `lastActivityAt`: último registro (bitácora) del caso. Cada registro nuevo lo renueva, reinicia
 *   los recordatorios y reactiva el caso.
 * - `followUpStage`: 0 = sin recordatorio; 1 = salió el de la semana; 2 = salió el de las 3 semanas.
 * - `inactiveAt`: el caso dejó de salir en el mapa (`getNearbyAnimals`) por no tener novedades.
 *
 * Lo manda el cron diario `sendAnimalFollowUps` (.github/workflows/send-animal-follow-ups.yml).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Primer recordatorio: una semana sin registros. */
export const FOLLOW_UP_FIRST_DAYS = 7;
/** Segundo recordatorio: 3 semanas sin registros (y al menos una semana después del primero). */
export const FOLLOW_UP_SECOND_DAYS = 21;
export const FOLLOW_UP_MIN_GAP_DAYS = 7;
/** Sin respuesta al segundo: el caso sale del mapa a los 45 días (y al menos 14 tras el segundo). */
export const INACTIVE_AFTER_DAYS = 45;
export const INACTIVE_MIN_GAP_DAYS = 14;
/** Reportes sin dueño a quién recordarle (automatización): salen del mapa a los 30 días. */
export const INACTIVE_UNOWNED_DAYS = 30;

export const daysAgo = (days: number, now = Date.now()) => new Date(now - days * DAY_MS);

/**
 * Hook de `AnimalLog` (solo `create`): el caso tuvo novedades. Escribe con Prisma para no pasar por
 * los hooks de `Animal` (actividad, repetidos) en cada registro. Nunca lanza.
 */
export async function touchAnimalActivity({
  operation,
  item,
  context,
}: {
  operation: string;
  item: any;
  context: KeystoneContext;
}) {
  if (operation !== "create") return;
  const animalId = item?.animalId ?? item?.animal;
  if (!animalId || typeof animalId !== "string") return;
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const result = await prisma.animal.updateMany({
      where: { id: animalId },
      data: { lastActivityAt: new Date(), followUpStage: 0, followUpSentAt: null, inactiveAt: null },
    });
    if (result instanceof Error) throw result;
  } catch (error) {
    console.error("[animal] No se pudo registrar la actividad del caso", { animalId }, error);
  }
}
