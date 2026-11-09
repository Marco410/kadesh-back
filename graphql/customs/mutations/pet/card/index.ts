import markPetAsLost from "./markPetAsLost";
import markPetAsFound from "./markPetAsFound";
import addPetFamilyMember from "./addPetFamilyMember";
import registerPetFamilyMember from "./registerPetFamilyMember";
import sendDuePetReminders from "./sendDuePetReminders";
import petTransfer from "./petTransfer";

/** Cartilla digital de la mascota. Ver docs/cartilla/README.md. */
const petCardMutations = {
  typeDefs: `
    ${markPetAsLost.typeDefs}
    ${markPetAsFound.typeDefs}
    ${addPetFamilyMember.typeDefs}
    ${registerPetFamilyMember.typeDefs}
    ${sendDuePetReminders.typeDefs}
    ${petTransfer.typeDefs}
  `,
  definition: `
    ${markPetAsLost.definition}
    ${markPetAsFound.definition}
    ${addPetFamilyMember.definition}
    ${registerPetFamilyMember.definition}
    ${sendDuePetReminders.definition}
    ${petTransfer.definition}
  `,
  resolver: {
    ...markPetAsLost.resolver,
    ...markPetAsFound.resolver,
    ...addPetFamilyMember.resolver,
    ...registerPetFamilyMember.resolver,
    ...sendDuePetReminders.resolver,
    ...petTransfer.resolver,
  },
};

export default petCardMutations;
