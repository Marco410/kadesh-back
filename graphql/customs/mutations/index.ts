import customAuth from "./auth/customAuth";
import authenticateUserWithGoogle from "./auth/authenticateUserWithGoogle";
import importBusinessLeadFromGoogle from "./importBusinessLeadFromGoogle";
import importPetPlace from "./importPetPlace";
import syncLeadsFront from "./syncLeadsFront";
import syncBusinessLeadsFromGoogle from "./syncBusinessLeadsFromGoogle";
import createCompanySubscription from "./createCompanySubscription";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${authenticateUserWithGoogle.typeDefs}
    ${importPetPlace.typeDefs}
    ${importBusinessLeadFromGoogle.typeDefs}
    ${syncBusinessLeadsFromGoogle.typeDefs}
    ${syncLeadsFront.typeDefs}
    ${createCompanySubscription.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${authenticateUserWithGoogle.definition}
    ${importPetPlace.definition}
    ${importBusinessLeadFromGoogle.definition}
    ${syncBusinessLeadsFromGoogle.definition}
    ${syncLeadsFront.definition}
    ${createCompanySubscription.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...authenticateUserWithGoogle.resolver,
    ...importPetPlace.resolver,
    ...importBusinessLeadFromGoogle.resolver,
    ...syncBusinessLeadsFromGoogle.resolver,
    ...syncLeadsFront.resolver,
    ...createCompanySubscription.resolver,
  },
  extraResolvers: {
    AuthenticateUserWithGoogleResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
};

export default customMutation;
