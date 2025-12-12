import customAuth from "./auth/customAuth";
import importPetPlace from "./importPetPlace";
import nearbyPetPlaces from "./nearbyPetPlaces";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${importPetPlace.typeDefs}
    ${nearbyPetPlaces.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${importPetPlace.definition}
    ${nearbyPetPlaces.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...importPetPlace.resolver,
    ...nearbyPetPlaces.resolver,
  },
};

export default customMutation;