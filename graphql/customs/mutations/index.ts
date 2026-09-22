import customAuth from "./auth/customAuth";
import authenticateUserWithGoogle from "./auth/authenticateUserWithGoogle";
import registerUser from "./auth/registerUser";
import importBusinessLeadFromGoogle from "./importBusinessLeadFromGoogle";
import importPetPlace from "./importPetPlace";
import syncLeadsFront from "./syncLeadsFront";
import syncBusinessLeadsFromGoogle from "./syncBusinessLeadsFromGoogle";
import createCompanySubscription from "./createCompanySubscription";
import addOwnLead from "./addOwnLead";
import remainingCredits from "./subcription/remainingCredits";
import purchaseCredits from "./credits/purchaseCredits";
import grantAdminCredits from "./credits/grantAdminCredits";
import sendTestEmail from "./sendTestEmail";
import updateCompanyAiSettings from "./ai/updateCompanyAiSettings";
import generateMarketInsight from "./ai/generateMarketInsight";
import dailyDigest from "../ai/dailyDigest";
import companyBrief from "../ai/companyBrief";
import syncEstablishmentsFromInegi from "./inegi/syncEstablishmentsFromInegi";
import syncLeadsFromInegi from "./inegi/syncLeadsFromInegi";
import promoteInegiEstablishmentToLead from "./inegi/promoteInegiEstablishmentToLead";
import fetchInegiIndicator from "./inegi/fetchInegiIndicator";
import veterinaryMutations from "./pet/veterinary";
import unsubscribeBlog from "./unsubscribeBlog";
import publishScheduledPosts from "./publishScheduledPosts";
import upsertDraftSystemRelease from "./upsertDraftSystemRelease";

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
    ${remainingCredits.typeDefs}
    ${purchaseCredits.typeDefs}
    ${grantAdminCredits.typeDefs}
    ${sendTestEmail.typeDefs}
    ${updateCompanyAiSettings.typeDefs}
    ${dailyDigest.typeDefs}
    ${companyBrief.typeDefs}
    ${generateMarketInsight.typeDefs}
    ${syncEstablishmentsFromInegi.typeDefs}
    ${syncLeadsFromInegi.typeDefs}
    ${promoteInegiEstablishmentToLead.typeDefs}
    ${fetchInegiIndicator.typeDefs}
    ${veterinaryMutations.typeDefs}
    ${unsubscribeBlog.typeDefs}
    ${publishScheduledPosts.typeDefs}
    ${upsertDraftSystemRelease.typeDefs}
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
    ${remainingCredits.definition}
    ${purchaseCredits.definition}
    ${grantAdminCredits.definition}
    ${sendTestEmail.definition}
    ${updateCompanyAiSettings.definition}
    ${dailyDigest.mutationDefinition}
    ${companyBrief.mutationDefinition}
    ${generateMarketInsight.mutationDefinition}
    ${syncEstablishmentsFromInegi.definition}
    ${syncLeadsFromInegi.definition}
    ${promoteInegiEstablishmentToLead.definition}
    ${fetchInegiIndicator.definition}
    ${veterinaryMutations.definition}
    ${unsubscribeBlog.definition}
    ${publishScheduledPosts.definition}
    ${upsertDraftSystemRelease.definition}
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
    ...remainingCredits.resolver,
    ...purchaseCredits.resolver,
    ...grantAdminCredits.resolver,
    ...sendTestEmail.resolver,
    ...updateCompanyAiSettings.resolver,
    ...dailyDigest.mutationResolver,
    ...companyBrief.mutationResolver,
    ...generateMarketInsight.mutationResolver,
    ...syncEstablishmentsFromInegi.resolver,
    ...syncLeadsFromInegi.resolver,
    ...promoteInegiEstablishmentToLead.resolver,
    ...fetchInegiIndicator.resolver,
    ...veterinaryMutations.resolver,
    ...unsubscribeBlog.resolver,
    ...publishScheduledPosts.resolver,
    ...upsertDraftSystemRelease.resolver,
  },
  extraResolvers: {
    AuthenticateUserWithGoogleResult: {
      __resolveType: (obj: { __typename?: string }) => obj.__typename ?? null,
    },
  },
};

export default customMutation;
