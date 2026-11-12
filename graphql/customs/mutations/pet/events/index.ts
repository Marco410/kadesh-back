import { petEventSharedTypeDefs } from "./shared";
import submitPetEvent from "./submitPetEvent";
import updateMyPetEvent from "./updateMyPetEvent";
import cancelPetEvent from "./cancelPetEvent";
import setPetEventInterest from "./setPetEventInterest";
import recordPetEventView from "./recordPetEventView";
import reviewPetEvent from "./reviewPetEvent";
import sendPetEventNotifications from "./sendPetEventNotifications";
import backfillAlertRegions from "./backfillAlertRegions";

/** Eventos de Kadesh Pet (campañas, jornadas). Ver models/Pet/PetEvent/README.md. */
const petEventMutations = {
  typeDefs: `
    ${petEventSharedTypeDefs}
    ${submitPetEvent.typeDefs}
    ${updateMyPetEvent.typeDefs}
    ${cancelPetEvent.typeDefs}
    ${setPetEventInterest.typeDefs}
    ${recordPetEventView.typeDefs}
    ${reviewPetEvent.typeDefs}
    ${sendPetEventNotifications.typeDefs}
    ${backfillAlertRegions.typeDefs}
  `,
  definition: `
    ${submitPetEvent.definition}
    ${updateMyPetEvent.definition}
    ${cancelPetEvent.definition}
    ${setPetEventInterest.definition}
    ${recordPetEventView.definition}
    ${reviewPetEvent.definition}
    ${sendPetEventNotifications.definition}
    ${backfillAlertRegions.definition}
  `,
  resolver: {
    ...submitPetEvent.resolver,
    ...updateMyPetEvent.resolver,
    ...cancelPetEvent.resolver,
    ...setPetEventInterest.resolver,
    ...recordPetEventView.resolver,
    ...reviewPetEvent.resolver,
    ...sendPetEventNotifications.resolver,
    ...backfillAlertRegions.resolver,
  },
};

export default petEventMutations;
