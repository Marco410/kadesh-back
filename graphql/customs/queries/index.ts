import nearbyAnimals from "./nearbyAnimals";
import nearbyPetPlaces from "./nearbyPetPlaces";
import stripePaymentMethods from "./saas/stripePaymentMethods";
import subscriptionStatus from "./saas/subscriptionStatus";
import dailyDigest from "../ai/dailyDigest";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${nearbyPetPlaces.typeDefs}
    ${stripePaymentMethods.typeDefs}
    ${subscriptionStatus.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${nearbyPetPlaces.definition}
    ${stripePaymentMethods.definition}
    ${subscriptionStatus.definition}
    ${dailyDigest.queryDefinition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...nearbyPetPlaces.resolver,
    ...stripePaymentMethods.resolver,
    ...subscriptionStatus.resolver,
    ...dailyDigest.queryResolver,
  },
};

export default customQuery;
