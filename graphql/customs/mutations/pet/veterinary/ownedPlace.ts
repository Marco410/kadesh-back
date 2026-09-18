import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { PET_PLACE_CLAIM_STATUS } from "../../../../../models/Pet/PetPlace/claim";

export type OwnedPlace = {
  id: string;
  name?: string | null;
  verified: boolean | null;
  claimStatus: string | null;
  user: { id: string } | null;
};

export type OwnedPlaceError = {
  success: false;
  message: string;
  petPlaceId: string | null;
};

export async function requireOwnedVerifiedPlace(
  context: KeystoneContext,
  petPlaceId: string,
  query = "id name verified claimStatus user { id }",
): Promise<{ userId: string; place: OwnedPlace } | OwnedPlaceError> {
  const userId = getSessionUserId(context.session);
  if (!userId) {
    return {
      success: false,
      message: "Inicia sesión para continuar.",
      petPlaceId: null,
    };
  }

  const place = (await context.sudo().query.PetPlace.findOne({
    where: { id: petPlaceId },
    query,
  })) as OwnedPlace | null;

  if (!place) {
    return {
      success: false,
      message: "No encontramos esta veterinaria.",
      petPlaceId: null,
    };
  }

  const isOwner = place.user?.id === userId;
  const isVerified =
    Boolean(place.verified) ||
    place.claimStatus === PET_PLACE_CLAIM_STATUS.VERIFIED;

  if (!isOwner || !isVerified) {
    return {
      success: false,
      message: isOwner
        ? "Cuando validemos la ficha podrás editar los datos."
        : "Solo el dueño verificado puede hacer esto.",
      petPlaceId: place.id,
    };
  }

  return { userId, place };
}
