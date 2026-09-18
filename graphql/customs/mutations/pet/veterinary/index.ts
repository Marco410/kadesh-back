import claimPetPlace from "./claimPetPlace";
import updateMyPetPlace from "./updateMyPetPlace";
import verifyPetPlace from "./verifyPetPlace";
import requestPetPlaceService from "./requestPetPlaceService";
import createPetPlacePatient from "./createPetPlacePatient";
import createClinicAppointment from "./createClinicAppointment";

const veterinaryMutations = {
  typeDefs: `
    ${claimPetPlace.typeDefs}
    ${updateMyPetPlace.typeDefs}
    ${verifyPetPlace.typeDefs}
    ${requestPetPlaceService.typeDefs}
    ${createPetPlacePatient.typeDefs}
    ${createClinicAppointment.typeDefs}
  `,
  definition: `
    ${claimPetPlace.definition}
    ${updateMyPetPlace.definition}
    ${verifyPetPlace.definition}
    ${requestPetPlaceService.definition}
    ${createPetPlacePatient.definition}
    ${createClinicAppointment.definition}
  `,
  resolver: {
    ...claimPetPlace.resolver,
    ...updateMyPetPlace.resolver,
    ...verifyPetPlace.resolver,
    ...requestPetPlaceService.resolver,
    ...createPetPlacePatient.resolver,
    ...createClinicAppointment.resolver,
  },
};

export default veterinaryMutations;
