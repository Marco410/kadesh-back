import storeCatalog from "./storeCatalog";
import myStoreWishlist from "./myStoreWishlist";
import storeOrders from "./storeOrders";

/** Kadesh Pet store, shopper side. See models/Pet/Store/README.md. */
const storeQueries = {
  typeDefs: `
    ${storeCatalog.typeDefs}
    ${myStoreWishlist.typeDefs}
    ${storeOrders.typeDefs}
  `,
  definition: `
    ${storeCatalog.definition}
    ${myStoreWishlist.definition}
    ${storeOrders.definition}
  `,
  resolver: {
    ...storeCatalog.resolver,
    ...myStoreWishlist.resolver,
    ...storeOrders.resolver,
  },
};

export default storeQueries;
