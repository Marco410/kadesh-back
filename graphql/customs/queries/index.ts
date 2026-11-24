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
import adminErrorIssues from "./admin/adminErrorIssues";
import adminPersonDevices from "./admin/adminPersonDevices";
import adminSecurity from "./admin/adminSecurity";
import adminHealth from "./admin/adminHealth";
import adminActivationFunnel from "./admin/adminActivationFunnel";
import adminCohorts from "./admin/adminCohorts";
import adminEngagement from "./admin/adminEngagement";
import adminDemandGaps from "./admin/adminDemandGaps";
import adminAcquisition from "./admin/adminAcquisition";
import adminSalesVelocity from "./admin/adminSalesVelocity";
import adminAnimals from "./admin/adminAnimals";
import adminAnimalChannelPost from "./admin/adminAnimalChannelPost";
import adminPet from "./admin/adminPet";
import adminNotifications from "./admin/adminNotifications";
import companyAnalytics from "./analytics/companyAnalytics";
import landingStats from "./landingStats";
import petLandingStats from "./petLandingStats";
import petReunionStories from "./petReunionStories";
import petEvents from "./petEvents";
import rescueAllies from "./rescueAllies";
import pawLeaderboard from "./pawLeaderboard";
import myPaws from "./myPaws";
import publicProfile from "./publicProfile";
import storeQueries from "./store";
import adminStore from "./admin/adminStore";
import adminStoreOrders from "./admin/adminStoreOrders";
import adminStoreSummary from "./admin/adminStoreSummary";
import adminAds from "./admin/adminAds";
import activeAds from "./pet/activeAds";

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
    ${adminErrorIssues.typeDefs}
    ${adminPersonDevices.typeDefs}
    ${adminSecurity.typeDefs}
    ${adminHealth.typeDefs}
    ${adminActivationFunnel.typeDefs}
    ${adminCohorts.typeDefs}
    ${adminEngagement.typeDefs}
    ${adminDemandGaps.typeDefs}
    ${adminAcquisition.typeDefs}
    ${adminSalesVelocity.typeDefs}
    ${adminAnimals.typeDefs}
    ${adminAnimalChannelPost.typeDefs}
    ${adminPet.typeDefs}
    ${adminNotifications.typeDefs}
    ${companyAnalytics.typeDefs}
    ${landingStats.typeDefs}
    ${petLandingStats.typeDefs}
    ${petReunionStories.typeDefs}
    ${rescueAllies.typeDefs}
    ${petEvents.typeDefs}
    ${pawLeaderboard.typeDefs}
    ${myPaws.typeDefs}
    ${publicProfile.typeDefs}
    ${storeQueries.typeDefs}
    ${adminStore.typeDefs}
    ${adminStoreOrders.typeDefs}
    ${adminStoreSummary.typeDefs}
    ${adminAds.typeDefs}
    ${activeAds.typeDefs}
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
    ${adminErrorIssues.definition}
    ${adminPersonDevices.definition}
    ${adminSecurity.definition}
    ${adminHealth.definition}
    ${adminActivationFunnel.definition}
    ${adminCohorts.definition}
    ${adminEngagement.definition}
    ${adminDemandGaps.definition}
    ${adminAcquisition.definition}
    ${adminSalesVelocity.definition}
    ${adminAnimals.definition}
    ${adminAnimalChannelPost.definition}
    ${adminPet.definition}
    ${adminNotifications.definition}
    ${companyAnalytics.definition}
    ${landingStats.definition}
    ${petLandingStats.definition}
    ${petReunionStories.definition}
    ${petEvents.definition}
    ${rescueAllies.definition}
    ${pawLeaderboard.definition}
    ${myPaws.definition}
    ${publicProfile.definition}
    ${storeQueries.definition}
    ${adminStore.definition}
    ${adminStoreOrders.definition}
    ${adminStoreSummary.definition}
    ${adminAds.definition}
    ${activeAds.definition}
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
    ...adminErrorIssues.resolver,
    ...adminPersonDevices.resolver,
    ...adminSecurity.resolver,
    ...adminHealth.resolver,
    ...adminActivationFunnel.resolver,
    ...adminCohorts.resolver,
    ...adminEngagement.resolver,
    ...adminDemandGaps.resolver,
    ...adminAcquisition.resolver,
    ...adminSalesVelocity.resolver,
    ...adminAnimals.resolver,
    ...adminAnimalChannelPost.resolver,
    ...adminPet.resolver,
    ...adminNotifications.resolver,
    ...companyAnalytics.resolver,
    ...landingStats.resolver,
    ...petLandingStats.resolver,
    ...petReunionStories.resolver,
    ...petEvents.resolver,
    ...rescueAllies.resolver,
    ...pawLeaderboard.resolver,
    ...myPaws.resolver,
    ...publicProfile.resolver,
    ...storeQueries.resolver,
    ...adminStore.resolver,
    ...adminStoreOrders.resolver,
    ...adminStoreSummary.resolver,
    ...adminAds.resolver,
    ...activeAds.resolver,
  },
};

export default customQuery;
