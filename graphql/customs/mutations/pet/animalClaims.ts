import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import {
  automationUserId,
  notifyClaimResolved,
} from "../../../../utils/notifications/animalReportAlerts";
import { ANIMAL_CLAIM_STATUS } from "../../../../models/Pet/Animal/AnimalClaim/constants";

/**
 * Responder una solicitud para quedarse con un reporte (`AnimalClaim`). La crea cualquiera con
 * sesión desde la API normal (`createAnimalClaim`); aprobarla o rechazarla le toca a quien atiende
 * el reporte, o a un admin si lo subió la automatización. Aprobar pasa el reporte a su nombre.
 */
const typeDefs = `
  type AnimalClaimResult {
    success: Boolean!
    message: String!
    animalSlug: String
  }

  type Mutation {
    resolveAnimalClaim(claimId: ID!, approve: Boolean!, reason: String): AnimalClaimResult!
    cancelAnimalClaim(claimId: ID!): AnimalClaimResult!
  }
`;

const definition = `
  resolveAnimalClaim(claimId: ID!, approve: Boolean!, reason: String): AnimalClaimResult!
  cancelAnimalClaim(claimId: ID!): AnimalClaimResult!
`;

type ClaimRow = {
  id: string;
  status: string;
  phone?: string | null;
  claimant?: { id: string } | null;
  animal?: {
    id: string;
    name?: string | null;
    slug?: string | null;
    contactNumber?: string | null;
    contactNumber2?: string | null;
    user?: { id: string } | null;
  } | null;
};

const CLAIM_QUERY =
  "id status phone claimant { id } animal { id name slug contactNumber contactNumber2 user { id } }";

async function loadClaim(context: KeystoneContext, claimId: string) {
  return (await context.sudo().query.AnimalClaim.findOne({
    where: { id: claimId },
    query: CLAIM_QUERY,
  })) as ClaimRow | null;
}

function fail(message: string) {
  return { success: false, message, animalSlug: null };
}

/** Quien atiende el reporte decide; si es la cuenta de automatización (o no hay), solo un admin. */
function canResolve(context: KeystoneContext, claim: ClaimRow) {
  if (isPlatformAdmin(context.session)) return true;
  const userId = getSessionUserId(context.session);
  const ownerId = claim.animal?.user?.id;
  if (!userId || !ownerId) return false;
  return ownerId === userId && ownerId !== automationUserId();
}

const resolver = {
  resolveAnimalClaim: async (
    _root: unknown,
    { claimId, approve, reason }: { claimId: string; approve: boolean; reason?: string | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para responder la solicitud.");
    const claim = await loadClaim(context, claimId);
    if (!claim?.animal || !claim.claimant) return fail("No encontramos esa solicitud.");
    if (claim.status !== ANIMAL_CLAIM_STATUS.PENDING) return fail("Esta solicitud ya se respondió.");
    if (!canResolve(context, claim)) return fail("Solo quien reportó al animal puede responder.");

    const sudo = context.sudo();
    const animal = claim.animal;
    const now = new Date().toISOString();
    const cleanReason = reason?.trim().slice(0, 300) || null;

    if (!approve) {
      await sudo.query.AnimalClaim.updateOne({
        where: { id: claim.id },
        data: {
          status: ANIMAL_CLAIM_STATUS.REJECTED,
          rejectReason: cleanReason ?? "",
          resolvedBy: { connect: { id: userId } },
          resolvedAt: now,
        },
      });
      void notifyClaimResolved(context, {
        claimantId: claim.claimant.id,
        animal,
        approved: false,
        reason: cleanReason,
      });
      void logActivity(context, {
        type: "animal.claim_rejected",
        summary: `Rechazó la solicitud para el reporte «${animal.name ?? animal.id}»`,
        entityType: "Animal",
        entityId: animal.id,
        metadata: { claimId: claim.id },
      });
      return { success: true, message: "Rechazaste la solicitud.", animalSlug: animal.slug ?? null };
    }

    // El teléfono de quien reclama queda como principal; el anterior, de segundo si estaba libre.
    const previousPhone = animal.contactNumber?.trim() || "";
    const claimPhone = claim.phone?.trim() || "";
    const contactNumber = claimPhone || previousPhone;
    const contactNumber2 =
      animal.contactNumber2?.trim() || (claimPhone && previousPhone !== claimPhone ? previousPhone : "");

    await sudo.query.Animal.updateOne({
      where: { id: animal.id },
      data: {
        user: { connect: { id: claim.claimant.id } },
        reportedBy: "owner",
        contactNumber,
        contactNumber2,
      },
    });
    await sudo.query.AnimalClaim.updateOne({
      where: { id: claim.id },
      data: {
        status: ANIMAL_CLAIM_STATUS.APPROVED,
        resolvedBy: { connect: { id: userId } },
        resolvedAt: now,
      },
    });
    void notifyClaimResolved(context, { claimantId: claim.claimant.id, animal, approved: true });

    const others = (await sudo.query.AnimalClaim.findMany({
      where: {
        animal: { id: { equals: animal.id } },
        status: { equals: ANIMAL_CLAIM_STATUS.PENDING },
      },
      query: "id claimant { id }",
    })) as Array<{ id: string; claimant?: { id: string } | null }>;
    const otherReason = "El reporte ya pasó a nombre de otra persona.";
    for (const other of others) {
      await sudo.query.AnimalClaim.updateOne({
        where: { id: other.id },
        data: {
          status: ANIMAL_CLAIM_STATUS.REJECTED,
          rejectReason: otherReason,
          resolvedBy: { connect: { id: userId } },
          resolvedAt: now,
        },
      });
      if (other.claimant?.id) {
        void notifyClaimResolved(context, {
          claimantId: other.claimant.id,
          animal,
          approved: false,
          reason: `${otherReason} Puedes dejar un comentario en la ficha.`,
        });
      }
    }

    void logActivity(context, {
      type: "animal.claim_approved",
      summary: `Pasó el reporte «${animal.name ?? animal.id}» a nombre de quien lo reclamó`,
      entityType: "Animal",
      entityId: animal.id,
      metadata: {
        claimId: claim.id,
        previousUserId: animal.user?.id ?? null,
        newUserId: claim.claimant.id,
        rejectedOthers: others.length,
      },
    });
    return {
      success: true,
      message: "Listo. El reporte ya está a nombre de quien lo reclamó.",
      animalSlug: animal.slug ?? null,
    };
  },

  cancelAnimalClaim: async (_root: unknown, { claimId }: { claimId: string }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para cancelar la solicitud.");
    const claim = await loadClaim(context, claimId);
    if (!claim?.animal) return fail("No encontramos esa solicitud.");
    if (claim.claimant?.id !== userId) return fail("Solo quien hizo la solicitud puede cancelarla.");
    if (claim.status !== ANIMAL_CLAIM_STATUS.PENDING) return fail("Esta solicitud ya se respondió.");
    await context.sudo().query.AnimalClaim.updateOne({
      where: { id: claim.id },
      data: { status: ANIMAL_CLAIM_STATUS.CANCELLED, resolvedAt: new Date().toISOString() },
    });
    return { success: true, message: "Cancelaste tu solicitud.", animalSlug: claim.animal.slug ?? null };
  },
};

const animalClaims = { typeDefs, definition, resolver };
export default animalClaims;
