import customAuth from "./auth/customAuth";
import importPetPlace from "./importPetPlace";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${importPetPlace.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${importPetPlace.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...importPetPlace.resolver,
  },
};

export default customMutation;