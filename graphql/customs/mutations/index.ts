import customAuth from "./auth/customAuth";
import importBusinessLeadFromGoogle from "./importBusinessLeadFromGoogle";
import importPetPlace from "./importPetPlace";
import syncBusinessLeadsFromGoogle from "./syncBusinessLeadsFromGoogle";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${importPetPlace.typeDefs}
    ${importBusinessLeadFromGoogle.typeDefs}
    ${syncBusinessLeadsFromGoogle.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${importPetPlace.definition}
    ${importBusinessLeadFromGoogle.definition}
    ${syncBusinessLeadsFromGoogle.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...importPetPlace.resolver,
    ...importBusinessLeadFromGoogle.resolver,
    ...syncBusinessLeadsFromGoogle.resolver,
  },
};

export default customMutation;
