import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { petPublicUrl } from "../pet/animalReport";
import { isGenericName } from "../pet/reportSimilarity";
import { notify } from "./notify";

/**
 * Avisos de un reporte a quien lo atiende: comentarios, solicitudes para quedarse con el reporte
 * y reportes unidos. Como `notify`, nunca lanzan; llamar con `void`.
 */

const EXCERPT_MAX = 140;

export function automationUserId() {
  return process.env.PET_AUTOMATION_USER_ID?.trim() || "";
}

/** Quien atiende el reporte: su autor, o los admins si lo subió la automatización o no tiene autor. */
export function reportAudience(userId?: string | null): "platform_admins" | string[] {
  const automation = automationUserId();
  if (!userId || (automation && userId === automation)) return "platform_admins";
  return [userId];
}

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > EXCERPT_MAX ? `${clean.slice(0, EXCERPT_MAX - 1)}…` : clean;
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Alguien";
}

/** «Chaneque», o null si el reporte no tiene un nombre que diga algo («Sin nombre»). */
function animalName(name?: string | null) {
  return name && !isGenericName(name) ? name.trim() : null;
}

function reportUrl(animal: { id: string; slug?: string | null }, suffix = "") {
  return `${petPublicUrl(animal.slug || animal.id)}${suffix}`;
}

type CommentInput = {
  commentId: string;
  animalId: string | null;
  authorId: string | null;
  kind: string;
  comment: string;
};

export async function notifyAnimalComment(context: KeystoneContext, input: CommentInput): Promise<void> {
  try {
    if (!input.animalId) return;
    const sudo = context.sudo();
    const animal = (await sudo.query.Animal.findOne({
      where: { id: input.animalId },
      query: "id name slug user { id } logs(orderBy: { createdAt: desc }, take: 1) { status }",
    })) as {
      id: string;
      name?: string | null;
      slug?: string | null;
      user?: { id: string } | null;
      logs?: Array<{ status?: string | null }> | null;
    } | null;
    if (!animal) return;

    const audience = reportAudience(animal.user?.id);
    const isComment = input.kind !== "duplicate_report" && input.kind !== "possible_match";
    // Los comentarios normales en reportes de la automatización no llegan a nadie (ruido).
    if (audience === "platform_admins" && isComment) return;
    if (Array.isArray(audience) && input.authorId && audience.includes(input.authorId)) return;

    const author = input.authorId
      ? ((await sudo.query.User.findOne({ where: { id: input.authorId }, query: "name" })) as {
          name?: string | null;
        } | null)
      : null;
    const who = firstName(author?.name);
    const name = animalName(animal.name);
    const text = excerpt(input.comment);
    const lost = (animal.logs?.[0]?.status ?? "") === "lost";

    let type: (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE] = NOTIFICATION_TYPE.ANIMAL_COMMENTED;
    let title = name ? `${who} comentó en el reporte de ${name}` : `${who} comentó en tu reporte`;
    let body = text;
    if (input.kind === "duplicate_report") {
      type = NOTIFICATION_TYPE.ANIMAL_DUPLICATE_REPORTED;
      title = name ? `Alguien más reportó a ${name}` : "Alguien más reportó al mismo animal";
      body = `${who} iba a publicar el mismo reporte y dejó esto: «${text}»`;
    } else if (input.kind === "possible_match") {
      type = NOTIFICATION_TYPE.ANIMAL_POSSIBLE_MATCH;
      title = lost
        ? `Podrían haber encontrado a ${name ?? "tu mascota"}`
        : `Alguien podría ser la familia de ${name ?? "el animal que reportaste"}`;
      body = `${who} cree que es el mismo animal: «${text}»`;
    }

    await notify(context, {
      audience,
      product: "pet",
      type,
      title,
      body,
      entityType: "Animal",
      entityId: animal.id,
      url: reportUrl(animal, "#comentarios"),
      metadata: { slug: animal.slug ?? null, commentId: input.commentId, kind: input.kind },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar del comentario:", input.commentId, error);
  }
}

export async function notifyClaimRequested(context: KeystoneContext, claimId: string): Promise<void> {
  try {
    const claim = (await context.sudo().query.AnimalClaim.findOne({
      where: { id: claimId },
      query: "id claimant { id name } animal { id name slug user { id } }",
    })) as {
      id: string;
      claimant?: { id: string; name?: string | null } | null;
      animal?: { id: string; name?: string | null; slug?: string | null; user?: { id: string } | null } | null;
    } | null;
    if (!claim?.animal) return;
    const name = animalName(claim.animal.name);
    const who = firstName(claim.claimant?.name);
    await notify(context, {
      audience: reportAudience(claim.animal.user?.id),
      product: "pet",
      type: NOTIFICATION_TYPE.ANIMAL_CLAIM_REQUESTED,
      title: name ? `${who} dice que ${name} es su mascota` : `${who} dice que el animal de tu reporte es su mascota`,
      body: "Revisa su mensaje y decide si el reporte pasa a su nombre.",
      entityType: "Animal",
      entityId: claim.animal.id,
      url: reportUrl(claim.animal, `?reclamo=${claim.id}`),
      metadata: { slug: claim.animal.slug ?? null, claimId: claim.id },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar de la solicitud:", claimId, error);
  }
}

export async function notifyClaimResolved(
  context: KeystoneContext,
  input: {
    claimantId: string;
    animal: { id: string; name?: string | null; slug?: string | null };
    approved: boolean;
    reason?: string | null;
  },
): Promise<void> {
  try {
    const name = animalName(input.animal.name);
    await notify(context, {
      audience: [input.claimantId],
      product: "pet",
      type: input.approved ? NOTIFICATION_TYPE.ANIMAL_CLAIM_APPROVED : NOTIFICATION_TYPE.ANIMAL_CLAIM_REJECTED,
      title: input.approved
        ? `Ahora el reporte de ${name ?? "tu mascota"} es tuyo`
        : `No se aceptó tu solicitud para ${name ?? "el reporte"}`,
      body: input.approved
        ? "Revisa que el teléfono y los datos de contacto sean los tuyos."
        : input.reason?.trim() ||
          "Quien lo reportó no la aceptó. Puedes dejarle un comentario en la ficha.",
      entityType: "Animal",
      entityId: input.animal.id,
      url: reportUrl(input.animal),
      metadata: { slug: input.animal.slug ?? null },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar la respuesta de la solicitud:", input.animal.id, error);
  }
}

export async function notifyAnimalMerged(
  context: KeystoneContext,
  input: {
    userId: string;
    duplicateName: string | null;
    main: { id: string; slug?: string | null };
  },
): Promise<void> {
  try {
    const name = animalName(input.duplicateName);
    await notify(context, {
      audience: [input.userId],
      product: "pet",
      type: NOTIFICATION_TYPE.ANIMAL_MERGED,
      title: name ? `Tu reporte de ${name} se unió a otro` : "Tu reporte se unió a otro",
      body: "Ya había un reporte del mismo animal. Los comentarios se pasaron ahí para buscarlo en un solo lugar.",
      entityType: "Animal",
      entityId: input.main.id,
      url: reportUrl(input.main),
      metadata: { slug: input.main.slug ?? null },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar del reporte unido:", input.main.id, error);
  }
}
