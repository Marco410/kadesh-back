import customAuth from "./auth/customAuth";
import authenticateUserWithGoogle from "./auth/authenticateUserWithGoogle";
import registerUser from "./auth/registerUser";
import importBusinessLeadFromGoogle from "./importBusinessLeadFromGoogle";
import importPetPlace from "./importPetPlace";
import syncLeadsFront from "./syncLeadsFront";
import syncBusinessLeadsFromGoogle from "./syncBusinessLeadsFromGoogle";
import createCompanySubscription from "./createCompanySubscription";
import addOwnLead from "./addOwnLead";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${authenticateUserWithGoogle.typeDefs}
    ${registerUser.typeDefs}
    ${importPetPlace.typeDefs}
    ${importBusinessLeadFromGoogle.typeDefs}
    ${syncBusinessLeadsFromGoogle.typeDefs}
    ${syncLeadsFront.typeDefs}
    ${createCompanySubscription.typeDefs}
    ${addOwnLead.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${authenticateUserWithGoogle.definition}
    ${registerUser.definition}
    ${importPetPlace.definition}
    ${importBusinessLeadFromGoogle.definition}
    ${syncBusinessLeadsFromGoogle.definition}
    ${syncLeadsFront.definition}
    ${createCompanySubscription.definition}
    ${addOwnLead.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...authenticateUserWithGoogle.resolver,
    ...registerUser.resolver,
    ...importPetPlace.resolver,
    ...importBusinessLeadFromGoogle.resolver,
    ...syncBusinessLeadsFromGoogle.resolver,
    ...syncLeadsFront.resolver,
    ...createCompanySubscription.resolver,
    ...addOwnLead.resolver,
  },
  extraResolvers: {
    AuthenticateUserWithGoogleResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
};

export default customMutation;
