import nearbyAnimals from "./nearbyAnimals";
import nearbyPetPlaces from "./nearbyPetPlaces";
import stripePaymentMethods from "./saas/stripePaymentMethods";
import subscriptionStatus from "./saas/subscriptionStatus";
import dailyDigest from "../ai/dailyDigest";
import companyBrief from "../ai/companyBrief";
import generateMarketInsight from "../ai/generateMarketInsight";
import previewWhatsAppChatExport from "./whatsapp/previewWhatsAppChatExport";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${nearbyPetPlaces.typeDefs}
    ${stripePaymentMethods.typeDefs}
    ${subscriptionStatus.typeDefs}
    ${previewWhatsAppChatExport.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${nearbyPetPlaces.definition}
    ${stripePaymentMethods.definition}
    ${subscriptionStatus.definition}
    ${dailyDigest.queryDefinition}
    ${companyBrief.queryDefinition}
    ${generateMarketInsight.queryDefinition}
    ${previewWhatsAppChatExport.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...nearbyPetPlaces.resolver,
    ...stripePaymentMethods.resolver,
    ...subscriptionStatus.resolver,
    ...dailyDigest.queryResolver,
    ...companyBrief.queryResolver,
    ...generateMarketInsight.queryResolver,
    ...previewWhatsAppChatExport.resolver,
  },
};

export default customQuery;
