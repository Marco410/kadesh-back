import storeCatalog from "./storeCatalog";
import myStoreWishlist from "./myStoreWishlist";

/** Kadesh Pet store, shopper side. See models/Pet/Store/README.md. */
const storeQueries = {
  typeDefs: `
    ${storeCatalog.typeDefs}
    ${myStoreWishlist.typeDefs}
  `,
  definition: `
    ${storeCatalog.definition}
    ${myStoreWishlist.definition}
  `,
  resolver: {
    ...storeCatalog.resolver,
    ...myStoreWishlist.resolver,
  },
};

export default storeQueries;
