import type { KeystoneContext } from "@keystone-6/core/types";
import { STORE_PRODUCT_STATUS, STORE_WISHLIST_MAX } from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { storePrisma } from "../../../../utils/store/catalog";
import { storeEnabled } from "../../../../utils/store/config";

const typeDefs = `
  type StoreWishlistResult {
    success: Boolean!
    message: String!
    "Whether the product is saved after this call."
    saved: Boolean!
  }
`;

const definition = `
  setStoreWishlist(productId: ID!, saved: Boolean!): StoreWishlistResult!
`;

const resolver = {
  /** Saves a product to the wishlist or takes it out. One row per person and product. */
  setStoreWishlist: async (
    _root: unknown,
    { productId, saved }: { productId: string; saved: boolean },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para guardar productos.", saved: false };
    if (!storeEnabled() && !isPlatformAdmin(context.session)) {
      return { success: false, message: "La tienda aún no está disponible.", saved: false };
    }

    try {
      const prisma = storePrisma(context);
      const key = `${userId}:${productId}`;

      if (!saved) {
        const removed = await prisma.storeWishlistItem.deleteMany({ where: { key } });
        if (removed instanceof Error) throw removed;
        return { success: true, message: "Listo.", saved: false };
      }

      const [product, count] = await Promise.all([
        prisma.storeProduct.findUnique({ where: { id: productId }, select: { status: true } }),
        prisma.storeWishlistItem.count({ where: { userId } }),
      ]);
      if (product instanceof Error) throw product;
      if (count instanceof Error) throw count;
      if (!product || product.status !== STORE_PRODUCT_STATUS.ACTIVE) {
        return { success: false, message: "Este producto ya no está disponible.", saved: false };
      }
      if (Number(count) >= STORE_WISHLIST_MAX) {
        return { success: false, message: "Tu lista de deseos está llena.", saved: false };
      }

      const row = await prisma.storeWishlistItem.upsert({
        where: { key },
        create: { key, user: { connect: { id: userId } }, product: { connect: { id: productId } } },
        update: {},
      });
      if (row instanceof Error) throw row;
      return { success: true, message: "Guardado en tu lista de deseos.", saved: true };
    } catch (error) {
      console.error("[setStoreWishlist]", error);
      return { success: false, message: "No pudimos guardar el producto. Intenta de nuevo.", saved: false };
    }
  },
};

export default { typeDefs, definition, resolver };
