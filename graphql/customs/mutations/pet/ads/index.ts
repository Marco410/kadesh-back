import recordAdEvents from "./recordAdEvents";
import expireAds from "./expireAds";

/** Kadesh Pet ads. See models/Pet/Ad/README.md. */
const adMutations = {
  typeDefs: `
    ${recordAdEvents.typeDefs}
    ${expireAds.typeDefs}
  `,
  definition: `
    ${recordAdEvents.definition}
    ${expireAds.definition}
  `,
  resolver: {
    ...recordAdEvents.resolver,
    ...expireAds.resolver,
  },
};

export default adMutations;
