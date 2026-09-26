import nearbyAnimals from "./nearbyAnimals";
import nearbyPetPlaces from "./nearbyPetPlaces";
import stripePaymentMethods from "./saas/stripePaymentMethods";
import stripePlanCheck from "./saas/stripePlanCheck";
import subscriptionStatus from "./saas/subscriptionStatus";
import dailyDigest from "../ai/dailyDigest";
import companyBrief from "../ai/companyBrief";
import generateMarketInsight from "../ai/generateMarketInsight";
import previewWhatsAppChatExport from "./whatsapp/previewWhatsAppChatExport";
import companyWhatsappWebhookInfo from "./whatsapp/companyWhatsappWebhookInfo";
import whatsappConversations from "./whatsapp/whatsappConversations";
import businessLeadWhatsappStatus from "./whatsapp/businessLeadWhatsappStatus";
import companyWhatsappTeam from "./whatsapp/companyWhatsappTeam";
import companyWhatsappTemplates from "./whatsapp/companyWhatsappTemplates";
import syncGoogleCalendarNow from "./googleCalendar/syncGoogleCalendarNow";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${nearbyPetPlaces.typeDefs}
    ${stripePaymentMethods.typeDefs}
    ${stripePlanCheck.typeDefs}
    ${subscriptionStatus.typeDefs}
    ${previewWhatsAppChatExport.typeDefs}
    ${companyWhatsappWebhookInfo.typeDefs}
    ${whatsappConversations.typeDefs}
    ${businessLeadWhatsappStatus.typeDefs}
    ${companyWhatsappTeam.typeDefs}
    ${companyWhatsappTemplates.typeDefs}
    ${syncGoogleCalendarNow.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${nearbyPetPlaces.definition}
    ${stripePaymentMethods.definition}
    ${stripePlanCheck.definition}
    ${subscriptionStatus.definition}
    ${dailyDigest.queryDefinition}
    ${companyBrief.queryDefinition}
    ${generateMarketInsight.queryDefinition}
    ${previewWhatsAppChatExport.definition}
    ${companyWhatsappWebhookInfo.definition}
    ${whatsappConversations.definition}
    ${businessLeadWhatsappStatus.definition}
    ${companyWhatsappTeam.definition}
    ${companyWhatsappTemplates.definition}
    ${syncGoogleCalendarNow.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...nearbyPetPlaces.resolver,
    ...stripePaymentMethods.resolver,
    ...stripePlanCheck.resolver,
    ...subscriptionStatus.resolver,
    ...dailyDigest.queryResolver,
    ...companyBrief.queryResolver,
    ...generateMarketInsight.queryResolver,
    ...previewWhatsAppChatExport.resolver,
    ...companyWhatsappWebhookInfo.resolver,
    ...whatsappConversations.resolver,
    ...businessLeadWhatsappStatus.resolver,
    ...companyWhatsappTeam.resolver,
    ...companyWhatsappTemplates.resolver,
    ...syncGoogleCalendarNow.resolver,
  },
};

export default customQuery;
