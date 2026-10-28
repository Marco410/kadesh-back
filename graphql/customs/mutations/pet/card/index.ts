import markPetAsLost from "./markPetAsLost";
import markPetAsFound from "./markPetAsFound";
import addPetFamilyMember from "./addPetFamilyMember";
import registerPetFamilyMember from "./registerPetFamilyMember";
import sendDuePetReminders from "./sendDuePetReminders";

/** Cartilla digital de la mascota. Ver docs/cartilla/README.md. */
const petCardMutations = {
  typeDefs: `
    ${markPetAsLost.typeDefs}
    ${markPetAsFound.typeDefs}
    ${addPetFamilyMember.typeDefs}
    ${registerPetFamilyMember.typeDefs}
    ${sendDuePetReminders.typeDefs}
  `,
  definition: `
    ${markPetAsLost.definition}
    ${markPetAsFound.definition}
    ${addPetFamilyMember.definition}
    ${registerPetFamilyMember.definition}
    ${sendDuePetReminders.definition}
  `,
  resolver: {
    ...markPetAsLost.resolver,
    ...markPetAsFound.resolver,
    ...addPetFamilyMember.resolver,
    ...registerPetFamilyMember.resolver,
    ...sendDuePetReminders.resolver,
  },
};

export default petCardMutations;
