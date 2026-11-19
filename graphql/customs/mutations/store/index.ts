import setStoreWishlist from "./setStoreWishlist";
import storeProductReviews from "./storeProductReviews";

/** Kadesh Pet store, shopper side. See models/Pet/Store/README.md. */
const storeMutations = {
  typeDefs: `
    ${setStoreWishlist.typeDefs}
    ${storeProductReviews.typeDefs}
  `,
  definition: `
    ${setStoreWishlist.definition}
    ${storeProductReviews.definition}
  `,
  resolver: {
    ...setStoreWishlist.resolver,
    ...storeProductReviews.resolver,
  },
};

export default storeMutations;
