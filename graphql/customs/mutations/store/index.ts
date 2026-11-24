import setStoreWishlist from "./setStoreWishlist";
import storeProductReviews from "./storeProductReviews";
import placeStoreOrder from "./placeStoreOrder";
import storeOrderActions from "./storeOrderActions";
import recordStoreProductView from "./recordStoreProductView";

/** Kadesh Pet store, shopper side. See models/Pet/Store/README.md. */
const storeMutations = {
  typeDefs: `
    ${setStoreWishlist.typeDefs}
    ${storeProductReviews.typeDefs}
    ${placeStoreOrder.typeDefs}
    ${storeOrderActions.typeDefs}
    ${recordStoreProductView.typeDefs}
  `,
  definition: `
    ${setStoreWishlist.definition}
    ${storeProductReviews.definition}
    ${placeStoreOrder.definition}
    ${storeOrderActions.definition}
    ${recordStoreProductView.definition}
  `,
  resolver: {
    ...setStoreWishlist.resolver,
    ...storeProductReviews.resolver,
    ...placeStoreOrder.resolver,
    ...storeOrderActions.resolver,
    ...recordStoreProductView.resolver,
  },
};

export default storeMutations;
