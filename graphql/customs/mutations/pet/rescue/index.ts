import activateRescueOrganization from "./activateRescueOrganization";
import rescueMembers from "./rescueMembers";
import rescuePets from "./rescuePets";
import { rescueSharedTypeDefs } from "./shared";

/** Espacios de rescate. Ver models/Pet/RescueOrganization/README.md. */
const rescueMutations = {
  typeDefs: `
    ${rescueSharedTypeDefs}
    ${activateRescueOrganization.typeDefs}
    ${rescueMembers.typeDefs}
    ${rescuePets.typeDefs}
  `,
  definition: `
    ${activateRescueOrganization.definition}
    ${rescueMembers.definition}
    ${rescuePets.definition}
  `,
  resolver: {
    ...activateRescueOrganization.resolver,
    ...rescueMembers.resolver,
    ...rescuePets.resolver,
  },
};

export default rescueMutations;
