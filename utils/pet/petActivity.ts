import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT, ACTIVITY_SOURCE } from "../../models/ActivityEvent/constants";
import { ANIMAL_LOGS_OPTIONS } from "../constants/constants";
import { isSudoContext } from "../activity/listActivityHooks";
import { logActivity } from "../activity/logActivity";

/**
 * Actividad de Kadesh Pet (fase 6.4): reportes, cambios de estado, comentarios, reclamos,
 * veterinarias, reseñas, altas y contacto. Se llama desde los `afterOperation` de cada list.
 *
 * Reglas:
 * - Nunca se guarda el texto de comentarios, reseñas o mensajes: solo ids, largo y calificación.
 * - Ediciones y borrados hechos por el servidor (`sudo()`: slugs, fusiones, duplicados) no se
 *   registran aquí; esos flujos dejan su propio evento.
 * - Nunca lanza ni frena la operación (`logActivity` sin await).
 */

type HookArgs = {
  operation: string;
  item?: Record<string, any> | null;
  originalItem?: Record<string, any> | null;
  inputData?: Record<string, unknown> | null;
  context: KeystoneContext;
};

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ANIMAL_LOGS_OPTIONS.map((option) => [option.value, option.label.toLowerCase()]),
);

/** La bitácora inicial se crea junto con el reporte: no es un cambio de estado. */
const INITIAL_LOG_WINDOW_MS = 2 * 60 * 1000;

function quoted(name: unknown, fallback: string): string {
  return typeof name === "string" && name.trim() ? `"${name.trim().slice(0, 80)}"` : fallback;
}

function changedFields(inputData: Record<string, unknown> | null | undefined): string[] {
  return Object.keys(inputData ?? {}).slice(0, 20);
}

async function animalInfo(
  context: KeystoneContext,
  animalId: string | null | undefined,
): Promise<{ name: string | null; createdAt: Date | null }> {
  if (!animalId) return { name: null, createdAt: null };
  try {
    const prisma = context.sudo().prisma as any;
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { name: true, createdAt: true },
    });
    return { name: animal?.name ?? null, createdAt: animal?.createdAt ?? null };
  } catch {
    return { name: null, createdAt: null };
  }
}

async function placeName(context: KeystoneContext, placeId: string | null | undefined): Promise<string | null> {
  if (!placeId) return null;
  try {
    const prisma = context.sudo().prisma as any;
    const place = await prisma.petPlace.findUnique({ where: { id: placeId }, select: { name: true } });
    return place?.name ?? null;
  } catch {
    return null;
  }
}

/** `Animal`: publicar (también `createAnimalReport` y automatizaciones), editar y borrar. */
export async function logAnimalActivity({ operation, item, originalItem, inputData, context }: HookArgs) {
  const animal = item ?? originalItem;
  if (!animal?.id) return;
  const entity = { entityType: "Animal", entityId: String(animal.id) };
  if (operation === "create") {
    void logActivity(context, {
      type: ACTIVITY_EVENT.PET_ANIMAL_REPORTED,
      summary: `Publicó el reporte ${quoted(animal.name, "de un animal")}`,
      ...entity,
    });
    return;
  }
  if (isSudoContext(context)) return;
  if (operation === "update") {
    const fields = changedFields(inputData);
    if (fields.length === 0) return;
    void logActivity(context, {
      type: ACTIVITY_EVENT.PET_ANIMAL_UPDATED,
      summary: `Editó el reporte ${quoted(animal.name, "de un animal")}`,
      metadata: { fields },
      ...entity,
    });
    return;
  }
  if (operation === "delete") {
    void logActivity(context, {
      type: ACTIVITY_EVENT.PET_ANIMAL_DELETED,
      summary: `Borró el reporte ${quoted(animal.name, "de un animal")}`,
      ...entity,
    });
  }
}

/** `AnimalLog`: un estado nuevo (perdido, encontrado, adoptado…) o una bitácora borrada. */
export async function logAnimalLogActivity({ operation, item, originalItem, context }: HookArgs) {
  const log = item ?? originalItem;
  if (!log?.id) return;
  const animalId = (log.animalId ?? null) as string | null;
  if (operation === "create") {
    const animal = await animalInfo(context, animalId);
    const createdAt = animal.createdAt ? new Date(animal.createdAt).getTime() : 0;
    if (createdAt && Date.now() - createdAt < INITIAL_LOG_WINDOW_MS) return;
    const status = typeof log.status === "string" ? log.status : null;
    void logActivity(context, {
      type: ACTIVITY_EVENT.PET_ANIMAL_STATUS_CHANGED,
      summary: `Cambió el estado de ${quoted(animal.name, "un animal")} a ${
        (status && STATUS_LABELS[status]) || status || "otro"
      }`,
      entityType: "Animal",
      entityId: animalId,
      metadata: { status },
    });
    return;
  }
  if (operation === "delete" && !isSudoContext(context)) {
    const animal = await animalInfo(context, animalId);
    void logActivity(context, {
      type: ACTIVITY_EVENT.PET_ANIMAL_LOG_DELETED,
      summary: `Borró una actualización de ${quoted(animal.name, "un animal")}`,
      entityType: "Animal",
      entityId: animalId,
      metadata: { status: typeof log.status === "string" ? log.status : null },
    });
  }
}

/** `AnimalComment`: comentario, aviso de duplicado o posible coincidencia (sin el texto). */
export async function logAnimalCommentActivity({ operation, item, originalItem, context }: HookArgs) {
  const comment = item ?? originalItem;
  if (!comment?.id || isSudoContext(context)) return;
  if (operation !== "create" && operation !== "delete") return;
  const animalId = (comment.animalId ?? null) as string | null;
  const animal = await animalInfo(context, animalId);
  const kind = typeof comment.kind === "string" ? comment.kind : null;
  const length = typeof comment.comment === "string" ? comment.comment.length : null;
  void logActivity(context, {
    type: operation === "create" ? ACTIVITY_EVENT.PET_COMMENT_ADDED : ACTIVITY_EVENT.PET_COMMENT_DELETED,
    summary:
      operation === "create"
        ? `Comentó en ${quoted(animal.name, "un reporte")}`
        : `Borró un comentario de ${quoted(animal.name, "un reporte")}`,
    entityType: "Animal",
    entityId: animalId,
    metadata: { commentKind: kind, count: length },
  });
}

/** `AnimalClaim`: "este animal es mío". */
export async function logAnimalClaimRequested({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id) return;
  const animalId = (item.animalId ?? null) as string | null;
  const animal = await animalInfo(context, animalId);
  void logActivity(context, {
    type: ACTIVITY_EVENT.PET_CLAIM_REQUESTED,
    summary: `Pidió reclamar ${quoted(animal.name, "un animal")} como suyo`,
    entityType: "Animal",
    entityId: animalId,
  });
}

export async function logAnimalClaimCancelled(
  context: KeystoneContext,
  claim: { id: string; animalId?: string | null },
) {
  const animal = await animalInfo(context, claim.animalId ?? null);
  void logActivity(context, {
    type: ACTIVITY_EVENT.PET_CLAIM_CANCELLED,
    summary: `Canceló su solicitud de ${quoted(animal.name, "un animal")}`,
    entityType: "Animal",
    entityId: claim.animalId ?? null,
  });
}

/** `PetPlace`: registro desde `/veterinarias/registro` (la importación de Google usa sudo y no cuenta). */
export async function logPetPlaceRegistered({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id || isSudoContext(context)) return;
  void logActivity(context, {
    type: ACTIVITY_EVENT.PET_PLACE_REGISTERED,
    summary: `Registró la veterinaria ${quoted(item.name, "")}`.trim(),
    entityType: "PetPlace",
    entityId: String(item.id),
  });
}

/** Cambios del dueño o del admin sobre una veterinaria (mutations propias, sudo). */
export async function logPetPlaceEvent(
  context: KeystoneContext,
  type: string,
  placeId: string,
  verb: string,
  metadata?: Record<string, unknown>,
) {
  const name = await placeName(context, placeId);
  void logActivity(context, {
    type,
    summary: `${verb} ${quoted(name, "una veterinaria")}`,
    entityType: "PetPlace",
    entityId: placeId,
    metadata: metadata ?? null,
  });
}

/** `Review`: reseña de una veterinaria (sin el texto). */
export async function logReviewActivity({ operation, item, originalItem, context }: HookArgs) {
  const review = item ?? originalItem;
  if (!review?.id || isSudoContext(context)) return;
  if (operation !== "create" && operation !== "delete") return;
  const placeId = (review.pet_placeId ?? null) as string | null;
  const name = await placeName(context, placeId);
  void logActivity(context, {
    type: operation === "create" ? ACTIVITY_EVENT.PET_REVIEW_ADDED : ACTIVITY_EVENT.PET_REVIEW_DELETED,
    summary:
      operation === "create"
        ? `Calificó ${quoted(name, "una veterinaria")} con ${review.rating ?? "?"} estrellas`
        : `Borró una reseña de ${quoted(name, "una veterinaria")}`,
    entityType: "PetPlace",
    entityId: placeId,
    metadata: {
      rating: typeof review.rating === "number" ? review.rating : null,
      count: typeof review.review === "string" ? review.review.length : null,
    },
  });
}

/** `User` creado sin sesión (registro de Kadesh Pet web y app). El actor es la cuenta nueva. */
export async function logUserSignup({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id || isSudoContext(context)) return;
  if ((context.session as { itemId?: string } | undefined)?.itemId) return;
  void logActivity(context, {
    type: ACTIVITY_EVENT.AUTH_SIGNUP,
    actorId: String(item.id),
    companyId: null,
    summary: "Se registró",
    source: ACTIVITY_SOURCE.WEB,
    entityType: "User",
    entityId: String(item.id),
    metadata: { product: typeof item.product === "string" ? item.product : null },
  });
}

/** `ContactForm`: alguien escribió desde el sitio (sin nombre, correo ni mensaje). */
export async function logContactForm({ operation, item, context }: HookArgs) {
  if (operation !== "create" || !item?.id || isSudoContext(context)) return;
  void logActivity(context, {
    type: ACTIVITY_EVENT.CONTACT_FORM_SUBMITTED,
    summary: "Envió el formulario de contacto",
    source: ACTIVITY_SOURCE.WEB,
    entityType: "ContactForm",
    entityId: String(item.id),
  });
}
