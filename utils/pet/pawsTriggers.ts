import type { KeystoneContext } from "@keystone-6/core/types";
import { canEditAnimalAs } from "../../models/Pet/Animal/Animal.access";
import {
  CASE_MIN_AGE_HOURS,
  COMMENT_MIN_LENGTH,
  PAW_ACTION,
  PURCHASE_MIN_LINE_CENTS,
} from "../../models/Pet/Paws/constants";
import { RESCUE_ORG_STATUS } from "../../models/Pet/RescueOrganization/constants";
import { isSudoContext } from "../activity/listActivityHooks";
import { awardPaws, pawsEnabled, reversePaws, setPawAward } from "./paws";

/**
 * Where each Kadesh Pet action earns or loses paw points. One thin function per action, called
 * with `void` from the hook or mutation that performs it. None of them throws.
 *
 * The rules (points, caps, levels) are in `models/Pet/Paws/constants.ts`; the write is in
 * `paws.ts`. Here only: who earns, under which source key, and when it is taken back.
 */

type HookArgs = { operation: string; item?: any; originalItem?: any; context: KeystoneContext };

const HOUR_MS = 60 * 60 * 1000;

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function warn(where: string, error: unknown) {
  console.warn(`[paws] ${where}:`, error instanceof Error ? error.message : error);
}

/** Owner of a report and its rescue space, to tell someone else's help from self-interaction. */
async function loadAnimalOwner(
  context: KeystoneContext,
  animalId: string,
): Promise<{ userId: string | null; organizationId: string | null } | null> {
  const animal = await prismaOf(context).animal.findUnique({
    where: { id: animalId },
    select: { userId: true, organizationId: true },
  });
  if (animal instanceof Error) throw animal;
  return animal ?? null;
}

/**
 * First log of a report: that is when it is really published. `ownerId` must be the person in
 * session: `createAnimalReport` lets a session publish on behalf of someone else.
 */
export async function pawsOnReportPublished(
  context: KeystoneContext,
  input: { animalId: string; ownerId: string | null | undefined; sessionUserId: string | null | undefined },
): Promise<void> {
  if (!input.ownerId || input.ownerId !== input.sessionUserId) return;
  await awardPaws(context, {
    userId: input.ownerId,
    action: PAW_ACTION.REPORT_PUBLISHED,
    sourceKey: `report:${input.animalId}`,
    referenceType: "Animal",
    referenceId: input.animalId,
  });
}

/**
 * `Animal` afterOperation. Covers every way a case closes or reopens (`closeAnimalReport` and
 * `syncAnimalOutcomeFromLog` are the only writers of `outcome`), the merge of a duplicate and the
 * delete. Costs nothing when neither `outcome` nor `duplicateOf` changed.
 */
export async function pawsOnAnimalChange({ operation, item, originalItem, context }: HookArgs): Promise<void> {
  if (!pawsEnabled()) return;
  try {
    if (operation === "delete") {
      const id = originalItem?.id ? String(originalItem.id) : null;
      if (!id) return;
      await reversePaws(context, `report:${id}`);
      await reversePaws(context, `case:${id}`);
      return;
    }
    if (operation !== "update" || !item?.id) return;
    const id = String(item.id);

    // Merged into another report: it was a repeat, not a new case.
    if (!originalItem?.duplicateOfId && item.duplicateOfId) {
      await reversePaws(context, `report:${id}`);
      await reversePaws(context, `case:${id}`);
      return;
    }

    const before = originalItem?.outcome ?? null;
    const after = item.outcome ?? null;
    if (before === after) return;
    if (before && !after) {
      await reversePaws(context, `case:${id}`);
      return;
    }
    if (before || !after || item.duplicateOfId || !item.userId) return;

    // Any outcome pays the same, so nobody gains by closing as "reunited" when it was not.
    // A case opened and closed right away pays nothing.
    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
    const closedAt = item.closedAt ? new Date(item.closedAt).getTime() : Date.now();
    if (!Number.isFinite(createdAt) || closedAt - createdAt < CASE_MIN_AGE_HOURS * HOUR_MS) return;

    await awardPaws(context, {
      userId: String(item.userId),
      action: PAW_ACTION.CASE_CLOSED,
      sourceKey: `case:${id}`,
      referenceType: "Animal",
      referenceId: id,
      metadata: { outcome: after },
    });
  } catch (error) {
    warn("animal change", error);
  }
}

/** The owner claimed a found animal and whoever was caring for the report accepted: a confirmed reunion. */
export async function pawsOnClaimApproved(
  context: KeystoneContext,
  input: { animalId: string; previousOwnerId: string | null | undefined; claimantId: string },
): Promise<void> {
  if (!input.previousOwnerId || input.previousOwnerId === input.claimantId) return;
  await awardPaws(context, {
    userId: input.previousOwnerId,
    action: PAW_ACTION.REUNION_HELPED,
    sourceKey: `reunion:${input.animalId}`,
    referenceType: "Animal",
    referenceId: input.animalId,
  });
}

/** An adoption was completed in Kadesh: the adopter earns. `reportId` is the public report, if any. */
export async function pawsOnAdoptionCompleted(
  context: KeystoneContext,
  input: { adopterId: string; reportId?: string | null; petId: string },
): Promise<void> {
  await awardPaws(context, {
    userId: input.adopterId,
    action: PAW_ACTION.ADOPTION_COMPLETED,
    sourceKey: input.reportId ? `adoption:${input.reportId}` : `adoption:pet:${input.petId}`,
    referenceType: input.reportId ? "Animal" : "Pet",
    referenceId: input.reportId ?? input.petId,
  });
}

/**
 * "I saw it" from a signed-in person on someone else's report. One award per person and animal;
 * it stays while at least one of their sightings of that animal is visible.
 */
export async function pawsOnSightingChanged(
  context: KeystoneContext,
  input: {
    userId: string | null | undefined;
    animalId: string | null | undefined;
    /** The sighting was just created, so one is visible for sure: skips the count. */
    justCreated?: boolean;
  },
): Promise<void> {
  if (!pawsEnabled() || !input.userId || !input.animalId) return;
  try {
    const sourceKey = `sighting:${input.userId}:${input.animalId}`;
    if (!input.justCreated) {
      const visible = await prismaOf(context).animalSighting.count({
        where: { userId: input.userId, animalId: input.animalId, hidden: false },
      });
      if (visible instanceof Error) throw visible;
      if (visible === 0) {
        await reversePaws(context, sourceKey);
        return;
      }
    }
    const animal = await loadAnimalOwner(context, input.animalId);
    if (!animal || (await canEditAnimalAs(context, animal, input.userId))) return;
    await awardPaws(context, {
      userId: input.userId,
      action: PAW_ACTION.SIGHTING,
      sourceKey,
      referenceType: "Animal",
      referenceId: input.animalId,
    });
  } catch (error) {
    warn("sighting", error);
  }
}

/**
 * `AnimalComment` afterOperation. One award per person and report, for a comment with some
 * substance on someone else's report. Server-side comments (merge notes) do not count.
 */
export async function pawsOnAnimalComment({ operation, item, originalItem, context }: HookArgs): Promise<void> {
  if (!pawsEnabled()) return;
  try {
    if (operation === "create") {
      if (isSudoContext(context)) return;
      const userId: string | null = item?.userId ?? null;
      const animalId: string | null = item?.animalId ?? null;
      if (!userId || !animalId) return;
      if (String(item.comment ?? "").trim().length < COMMENT_MIN_LENGTH) return;
      const animal = await loadAnimalOwner(context, animalId);
      if (!animal || (await canEditAnimalAs(context, animal, userId))) return;
      await awardPaws(context, {
        userId,
        action: PAW_ACTION.COMMENT,
        sourceKey: `comment:${userId}:${animalId}`,
        referenceType: "Animal",
        referenceId: animalId,
      });
      return;
    }
    if (operation !== "delete") return;
    const userId: string | null = originalItem?.userId ?? null;
    const animalId: string | null = originalItem?.animalId ?? null;
    if (!userId || !animalId) return;
    const remaining = await prismaOf(context).animalComment.count({ where: { userId, animalId } });
    if (remaining instanceof Error) throw remaining;
    if (remaining === 0) await reversePaws(context, `comment:${userId}:${animalId}`);
  } catch (error) {
    warn("comment", error);
  }
}

/**
 * `Review` afterOperation. One award per person and place, never for your own place. Reviews
 * imported from Google (sudo) do not count.
 */
export async function pawsOnReview({ operation, item, originalItem, context }: HookArgs): Promise<void> {
  if (!pawsEnabled()) return;
  try {
    if (operation === "create") {
      if (isSudoContext(context)) return;
      const userId: string | null = item?.userId ?? null;
      const placeId: string | null = item?.pet_placeId ?? null;
      if (!userId || !placeId) return;
      const place = await prismaOf(context).petPlace.findUnique({
        where: { id: placeId },
        select: { userId: true },
      });
      if (place instanceof Error) throw place;
      if (!place || place.userId === userId) return;
      await awardPaws(context, {
        userId,
        action: PAW_ACTION.REVIEW,
        sourceKey: `review:${userId}:${placeId}`,
        referenceType: "PetPlace",
        referenceId: placeId,
      });
      return;
    }
    if (operation !== "delete") return;
    const userId: string | null = originalItem?.userId ?? null;
    const placeId: string | null = originalItem?.pet_placeId ?? null;
    if (!userId || !placeId) return;
    const remaining = await prismaOf(context).review.count({ where: { userId, pet_placeId: placeId } });
    if (remaining instanceof Error) throw remaining;
    if (remaining === 0) await reversePaws(context, `review:${userId}:${placeId}`);
  } catch (error) {
    warn("review", error);
  }
}

/** An admin published the event. An admin approving their own event earns nothing. */
export async function pawsOnEventApproved(
  context: KeystoneContext,
  input: { eventId: string; organizerId: string | null | undefined; reviewerId: string },
): Promise<void> {
  if (!input.organizerId || input.organizerId === input.reviewerId) return;
  await awardPaws(context, {
    userId: input.organizerId,
    action: PAW_ACTION.EVENT_APPROVED,
    sourceKey: `event:${input.eventId}`,
    referenceType: "PetEvent",
    referenceId: input.eventId,
  });
}

/** A published event was rejected, or cancelled before it happened. */
export async function pawsOnEventUnpublished(context: KeystoneContext, eventId: string): Promise<void> {
  await reversePaws(context, `event:${eventId}`);
}

/** First pet registered in the digital card: once per account. */
export async function pawsOnPetRegistered(context: KeystoneContext, userId: string, petId: string): Promise<void> {
  await awardPaws(context, {
    userId,
    action: PAW_ACTION.FIRST_PET,
    sourceKey: `first_pet:${userId}`,
    referenceType: "Pet",
    referenceId: petId,
  });
}

/** `PetHealthRecord` afterOperation: the first record a person adds, once per account. */
export async function pawsOnHealthRecord({ operation, item, context }: HookArgs): Promise<void> {
  if (operation !== "create" || !item?.id || !item.createdById || isSudoContext(context)) return;
  const userId = String(item.createdById);
  await awardPaws(context, {
    userId,
    action: PAW_ACTION.FIRST_HEALTH_RECORD,
    sourceKey: `first_health_record:${userId}`,
    referenceType: "PetHealthRecord",
    referenceId: String(item.id),
  });
}

/** A rescue space was verified (its creator earns) or lost the verification. */
export async function pawsOnRescueStatusChanged(
  context: KeystoneContext,
  org: { id: string; status: string; createdById?: string | null },
): Promise<void> {
  const verified = org.status === RESCUE_ORG_STATUS.VERIFIED;
  const closed = org.status === RESCUE_ORG_STATUS.REJECTED || org.status === RESCUE_ORG_STATUS.SUSPENDED;
  if (!verified && !closed) return;
  await setPawAward(context, {
    shouldHave: verified,
    userId: org.createdById ?? null,
    action: PAW_ACTION.RESCUE_VERIFIED,
    sourceKey: `rescue:${org.id}`,
    referenceType: "RescueOrganization",
    referenceId: org.id,
  });
}

/** An admin verified (or rejected) the owner of a place in the directory. */
export async function pawsOnPlaceVerification(
  context: KeystoneContext,
  input: { placeId: string; ownerId: string | null | undefined; verified: boolean },
): Promise<void> {
  await setPawAward(context, {
    shouldHave: input.verified,
    userId: input.ownerId ?? null,
    action: PAW_ACTION.PLACE_VERIFIED,
    sourceKey: `place:${input.placeId}`,
    referenceType: "PetPlace",
    referenceId: input.placeId,
  });
}

// ─── Store ──────────────────────────────────────────────────────────────────────────────────

/**
 * A store package was delivered: each of its order lines earns the buyer paws. Per line, not per
 * unit (five bags of the same food are one line), and only lines worth `PURCHASE_MIN_LINE_CENTS`
 * or more after discounts. Paid on delivery, not on payment, so a cancelled order never earned.
 */
export async function pawsOnStoreShipmentDelivered(context: KeystoneContext, shipmentId: string): Promise<void> {
  if (!pawsEnabled()) return;
  try {
    const items = await prismaOf(context).storeOrderItem.findMany({
      where: { shipmentId },
      take: 50,
      select: {
        id: true,
        totalCents: true,
        discountCents: true,
        order: { select: { userId: true, paymentStatus: true } },
      },
    });
    if (items instanceof Error) throw items;
    for (const item of items as Array<{
      id: string;
      totalCents: number;
      discountCents: number | null;
      order: { userId: string | null; paymentStatus: string } | null;
    }>) {
      const userId = item.order?.userId;
      if (!userId || item.order?.paymentStatus !== "paid") continue;
      if (item.totalCents - (Number(item.discountCents) || 0) < PURCHASE_MIN_LINE_CENTS) continue;
      await awardPaws(context, {
        userId,
        action: PAW_ACTION.PURCHASE,
        sourceKey: `purchase:${item.id}`,
        referenceType: "StoreOrderItem",
        referenceId: item.id,
      });
    }
  } catch (error) {
    warn("store purchase", error);
  }
}

/**
 * The purchase did not stand: the order was refunded (`orderId`) or one of its packages came back
 * (`shipmentId`). What those lines earned is taken back.
 */
export async function pawsOnStorePurchaseUndone(
  context: KeystoneContext,
  where: { orderId: string } | { shipmentId: string },
): Promise<void> {
  if (!pawsEnabled()) return;
  try {
    const items = await prismaOf(context).storeOrderItem.findMany({ where, take: 200, select: { id: true } });
    if (items instanceof Error) throw items;
    for (const item of items as Array<{ id: string }>) await reversePaws(context, `purchase:${item.id}`);
  } catch (error) {
    warn("store purchase undone", error);
  }
}

/**
 * Review of a store product. It earns only while it is a published review of something the person
 * bought and received (`shouldHave`), whatever the stars: deleting it, or an admin hiding it,
 * takes the paws back. One award per person and product.
 */
export async function pawsOnStoreProductReview(
  context: KeystoneContext,
  input: { userId: string | null | undefined; productId: string | null | undefined; shouldHave: boolean },
): Promise<void> {
  if (!pawsEnabled() || !input.userId || !input.productId) return;
  try {
    await setPawAward(context, {
      userId: input.userId,
      action: PAW_ACTION.PRODUCT_REVIEW,
      sourceKey: `product_review:${input.userId}:${input.productId}`,
      referenceType: "StoreProduct",
      referenceId: input.productId,
      shouldHave: input.shouldHave,
    });
  } catch (error) {
    warn("store product review", error);
  }
}
