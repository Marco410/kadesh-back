import nearbyAnimals from "./nearbyAnimals";
import findAnimalReportDuplicates from "./findAnimalReportDuplicates";
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
import { adminSharedTypeDefs } from "./admin/shared";
import adminCompanies from "./admin/adminCompanies";
import adminOpsSummary from "./admin/adminOpsSummary";
import adminCompanyInsights from "./admin/adminCompanyInsights";
import adminCompanyTrends from "./admin/adminCompanyTrends";
import adminActivityFeed from "./admin/adminActivityFeed";
import adminHealth from "./admin/adminHealth";
import adminActivationFunnel from "./admin/adminActivationFunnel";
import adminCohorts from "./admin/adminCohorts";
import adminEngagement from "./admin/adminEngagement";
import adminDemandGaps from "./admin/adminDemandGaps";
import adminAcquisition from "./admin/adminAcquisition";

const customQuery = {
  typeDefs: `
    ${nearbyAnimals.typeDefs}
    ${findAnimalReportDuplicates.typeDefs}
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
    ${adminSharedTypeDefs}
    ${adminCompanies.typeDefs}
    ${adminOpsSummary.typeDefs}
    ${adminCompanyInsights.typeDefs}
    ${adminCompanyTrends.typeDefs}
    ${adminActivityFeed.typeDefs}
    ${adminHealth.typeDefs}
    ${adminActivationFunnel.typeDefs}
    ${adminCohorts.typeDefs}
    ${adminEngagement.typeDefs}
    ${adminDemandGaps.typeDefs}
    ${adminAcquisition.typeDefs}
  `,
  definitions: `
    ${nearbyAnimals.definition}
    ${findAnimalReportDuplicates.definition}
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
    ${adminCompanies.definition}
    ${adminOpsSummary.definition}
    ${adminCompanyInsights.definition}
    ${adminCompanyTrends.definition}
    ${adminActivityFeed.definition}
    ${adminHealth.definition}
    ${adminActivationFunnel.definition}
    ${adminCohorts.definition}
    ${adminEngagement.definition}
    ${adminDemandGaps.definition}
    ${adminAcquisition.definition}
  `,
  resolvers: {
    ...nearbyAnimals.resolver,
    ...findAnimalReportDuplicates.resolver,
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
    ...adminCompanies.resolver,
    ...adminOpsSummary.resolver,
    ...adminCompanyInsights.resolver,
    ...adminCompanyTrends.resolver,
    ...adminActivityFeed.resolver,
    ...adminHealth.resolver,
    ...adminActivationFunnel.resolver,
    ...adminCohorts.resolver,
    ...adminEngagement.resolver,
    ...adminDemandGaps.resolver,
    ...adminAcquisition.resolver,
  },
};

export default customQuery;
