import claimPetPlace from "./claimPetPlace";
import updateMyPetPlace from "./updateMyPetPlace";
import verifyPetPlace from "./verifyPetPlace";

const veterinaryMutations = {
  typeDefs: `
    ${claimPetPlace.typeDefs}
    ${updateMyPetPlace.typeDefs}
    ${verifyPetPlace.typeDefs}
  `,
  definition: `
    ${claimPetPlace.definition}
    ${updateMyPetPlace.definition}
    ${verifyPetPlace.definition}
  `,
  resolver: {
    ...claimPetPlace.resolver,
    ...updateMyPetPlace.resolver,
    ...verifyPetPlace.resolver,
  },
};

export default veterinaryMutations;
