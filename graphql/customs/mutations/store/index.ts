import setStoreWishlist from "./setStoreWishlist";
import storeProductReviews from "./storeProductReviews";
import placeStoreOrder from "./placeStoreOrder";
import storeOrderActions from "./storeOrderActions";

/** Kadesh Pet store, shopper side. See models/Pet/Store/README.md. */
const storeMutations = {
  typeDefs: `
    ${setStoreWishlist.typeDefs}
    ${storeProductReviews.typeDefs}
    ${placeStoreOrder.typeDefs}
    ${storeOrderActions.typeDefs}
  `,
  definition: `
    ${setStoreWishlist.definition}
    ${storeProductReviews.definition}
    ${placeStoreOrder.definition}
    ${storeOrderActions.definition}
  `,
  resolver: {
    ...setStoreWishlist.resolver,
    ...storeProductReviews.resolver,
    ...placeStoreOrder.resolver,
    ...storeOrderActions.resolver,
  },
};

export default storeMutations;
