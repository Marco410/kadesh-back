import customAuth from "./auth/customAuth";
import authenticateUserWithGoogle from "./auth/authenticateUserWithGoogle";
import importBusinessLeadFromGoogle from "./importBusinessLeadFromGoogle";
import importPetPlace from "./importPetPlace";
import syncBusinessLeadsFromGoogle from "./syncBusinessLeadsFromGoogle";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${authenticateUserWithGoogle.typeDefs}
    ${importPetPlace.typeDefs}
    ${importBusinessLeadFromGoogle.typeDefs}
    ${syncBusinessLeadsFromGoogle.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${authenticateUserWithGoogle.definition}
    ${importPetPlace.definition}
    ${importBusinessLeadFromGoogle.definition}
    ${syncBusinessLeadsFromGoogle.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...authenticateUserWithGoogle.resolver,
    ...importPetPlace.resolver,
    ...importBusinessLeadFromGoogle.resolver,
    ...syncBusinessLeadsFromGoogle.resolver,
  },
  extraResolvers: {
    AuthenticateUserWithGoogleResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
};

export default customMutation;
