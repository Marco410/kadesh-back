import activateRescueOrganization from "./activateRescueOrganization";
import rescueMembers from "./rescueMembers";
import { rescueSharedTypeDefs } from "./shared";

/** Espacios de rescate. Ver models/Pet/RescueOrganization/README.md. */
const rescueMutations = {
  typeDefs: `
    ${rescueSharedTypeDefs}
    ${activateRescueOrganization.typeDefs}
    ${rescueMembers.typeDefs}
  `,
  definition: `
    ${activateRescueOrganization.definition}
    ${rescueMembers.definition}
  `,
  resolver: {
    ...activateRescueOrganization.resolver,
    ...rescueMembers.resolver,
  },
};

export default rescueMutations;
