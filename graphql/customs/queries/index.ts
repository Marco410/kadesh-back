import nearbyAnimals from "./nearbyAnimals";
import nearbyPetPlaces from "./nearbyPetPlaces";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${nearbyPetPlaces.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${nearbyPetPlaces.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...nearbyPetPlaces.resolver,
  },
};

export default customQuery;
