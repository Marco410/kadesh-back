import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import {
  STORE_PAYMENT_STATUS,
  STORE_PRODUCT_STATUS,
  STORE_REVIEW_BODY_MAX,
  STORE_REVIEW_STATUS,
  STORE_REVIEW_TITLE_MAX,
  STORE_SHIPMENT_STATUS,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { pawsOnStoreProductReview } from "../../../../utils/pet/pawsTriggers";
import { recomputeStoreProductRating, storePrisma } from "../../../../utils/store/catalog";
import { bumpStoreCatalogVersion, storeEnabled } from "../../../../utils/store/config";

/**
 * A shopper's review of a product: one per person and product, 1 to 5 stars. Every product starts
 * with no stars; only reviews written here count (nothing is imported from Dropi or Mercado Libre).
 *
 * These write with prisma (no list hooks), so they recompute the product's stars themselves.
 */

const typeDefs = `
  input StoreProductReviewInput {
    productId: ID!
    "1 to 5"
    rating: Int!
    title: String
    body: String
  }

  type StoreProductReviewResult {
    success: Boolean!
    message: String!
    reviewId: ID
    "Stars of the product after this change."
    ratingAverage: Float
    ratingCount: Int
  }
`;

const definition = `
  submitStoreProductReview(input: StoreProductReviewInput!): StoreProductReviewResult!
  deleteMyStoreProductReview(productId: ID!): StoreProductReviewResult!
`;

type ReviewInput = {
  productId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
};

const EMPTY = { reviewId: null, ratingAverage: null, ratingCount: null };

function fail(message: string) {
  return { success: false, message, ...EMPTY };
}

const resolver = {
  /** Writes or edits the caller's review of a product. */
  submitStoreProductReview: async (_root: unknown, { input }: { input: ReviewInput }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para dejar tu reseña.");
    if (!storeEnabled() && !isPlatformAdmin(context.session)) return fail("La tienda aún no está disponible.");

    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail("La calificación debe ser de 1 a 5 estrellas.");
    }
    const title = (input.title ?? "").trim();
    const body = (input.body ?? "").trim();
    if (title.length > STORE_REVIEW_TITLE_MAX) return fail("El título es demasiado largo.");
    if (body.length > STORE_REVIEW_BODY_MAX) return fail("La reseña es demasiado larga.");

    try {
      const prisma = storePrisma(context);
      const key = `${userId}:${input.productId}`;
      const [product, existing] = await Promise.all([
        prisma.storeProduct.findUnique({
          where: { id: input.productId },
          select: { id: true, name: true, status: true },
        }),
        prisma.storeProductReview.findUnique({ where: { key }, select: { id: true, status: true } }),
      ]);
      if (product instanceof Error) throw product;
      if (existing instanceof Error) throw existing;
      if (!product || product.status !== STORE_PRODUCT_STATUS.ACTIVE) {
        return fail("Este producto ya no está disponible.");
      }
      // A review hidden by an admin stays hidden: editing it must not bring it back.
      if (existing?.status === STORE_REVIEW_STATUS.HIDDEN) {
        return fail("Tu reseña de este producto fue retirada por el equipo de Kadesh.");
      }

      // Verified purchase: the person received this product in a delivered package of an order
      // that was not refunded.
      const delivered = await prisma.storeOrderItem.findFirst({
        where: {
          productId: input.productId,
          order: { userId, paymentStatus: STORE_PAYMENT_STATUS.PAID },
          shipment: { status: STORE_SHIPMENT_STATUS.DELIVERED },
        },
        select: { id: true },
      });
      if (delivered instanceof Error) throw delivered;
      const verifiedPurchase = Boolean(delivered);

      const saved = await prisma.storeProductReview.upsert({
        where: { key },
        create: {
          key,
          rating,
          title,
          body,
          verifiedPurchase,
          status: STORE_REVIEW_STATUS.PUBLISHED,
          product: { connect: { id: input.productId } },
          user: { connect: { id: userId } },
        },
        update: { rating, title, body, verifiedPurchase },
        select: { id: true },
      });
      if (saved instanceof Error) throw saved;

      const stars = await recomputeStoreProductRating(context, input.productId);
      bumpStoreCatalogVersion();
      // Paws for reviewing something bought and received, whatever the stars.
      void pawsOnStoreProductReview(context, { userId, productId: input.productId, shouldHave: verifiedPurchase });

      // Never the text of the review: only ids, length and rating.
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_STORE_REVIEW_ADDED,
        summary: `${existing ? "Editó su reseña de" : "Calificó"} "${String(product.name).slice(0, 80)}" con ${rating} estrellas`,
        entityType: "StoreProduct",
        entityId: input.productId,
        metadata: { rating, count: body.length, edited: Boolean(existing) },
      });

      return {
        success: true,
        message: existing ? "Actualizamos tu reseña." : "¡Gracias por tu reseña!",
        reviewId: saved.id,
        ratingAverage: stars?.ratingAverage ?? null,
        ratingCount: stars?.ratingCount ?? null,
      };
    } catch (error) {
      console.error("[submitStoreProductReview]", error);
      return fail("No pudimos guardar tu reseña. Intenta de nuevo.");
    }
  },

  /** Deletes the caller's own review of a product. */
  deleteMyStoreProductReview: async (
    _root: unknown,
    { productId }: { productId: string },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para borrar tu reseña.");

    try {
      const prisma = storePrisma(context);
      const removed = await prisma.storeProductReview.deleteMany({ where: { key: `${userId}:${productId}` } });
      if (removed instanceof Error) throw removed;
      if (Number(removed.count) === 0) return fail("No encontramos tu reseña de este producto.");

      const stars = await recomputeStoreProductRating(context, productId);
      bumpStoreCatalogVersion();
      void pawsOnStoreProductReview(context, { userId, productId, shouldHave: false });

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_STORE_REVIEW_DELETED,
        summary: "Borró su reseña de un producto",
        entityType: "StoreProduct",
        entityId: productId,
      });

      return {
        success: true,
        message: "Borramos tu reseña.",
        reviewId: null,
        ratingAverage: stars?.ratingAverage ?? null,
        ratingCount: stars?.ratingCount ?? null,
      };
    } catch (error) {
      console.error("[deleteMyStoreProductReview]", error);
      return fail("No pudimos borrar tu reseña. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
