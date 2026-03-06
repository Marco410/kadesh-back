import nearbyAnimals from "./nearbyAnimals";
import nearbyPetPlaces from "./nearbyPetPlaces";
import stripePaymentMethods from "./saas/stripePaymentMethods";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${nearbyPetPlaces.typeDefs}
    ${stripePaymentMethods.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${nearbyPetPlaces.definition}
    ${stripePaymentMethods.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...nearbyPetPlaces.resolver,
    ...stripePaymentMethods.resolver,
  },
};

export default customQuery;
