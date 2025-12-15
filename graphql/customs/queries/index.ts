import nearbyAnimals from "./nearbyAnimals";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
  },
};

export default customQuery;
