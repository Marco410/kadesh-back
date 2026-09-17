import { KeystoneContext } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
} from "../../../../../utils/access/tenant";
import { PET_PLACE_CLAIM_STATUS } from "../../../../../models/Pet/PetPlace/claim";

type PetPlaceVerifyRow = {
  id: string;
  user: { id: string } | null;
};

const typeDefs = `
  input VerifyPetPlaceInput {
    petPlaceId: String!
    approved: Boolean!
  }

  type VerifyPetPlaceResult {
    success: Boolean!
    message: String!
    claimStatus: String
    verified: Boolean
  }
`;

const definition = `
  verifyPetPlace(input: VerifyPetPlaceInput!): VerifyPetPlaceResult!
`;

const resolver = {
  verifyPetPlace: async (
    _root: unknown,
    {
      input,
    }: {
      input: { petPlaceId: string; approved: boolean };
    },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) {
      return {
        success: false,
        message: "Inicia sesión.",
        claimStatus: null,
        verified: null,
      };
    }

    if (!isPlatformAdmin(context.session)) {
      return {
        success: false,
        message: "Solo un administrador puede verificar una ficha.",
        claimStatus: null,
        verified: null,
      };
    }

    const place = (await context.sudo().query.PetPlace.findOne({
      where: { id: input.petPlaceId },
      query: "id user { id }",
    })) as PetPlaceVerifyRow | null;

    if (!place) {
      return {
        success: false,
        message: "No encontramos esta veterinaria.",
        claimStatus: null,
        verified: null,
      };
    }

    if (input.approved && !place.user?.id) {
      return {
        success: false,
        message: "No hay un solicitante vinculado para verificar.",
        claimStatus: PET_PLACE_CLAIM_STATUS.UNCLAIMED,
        verified: false,
      };
    }

    try {
      if (input.approved) {
        await context.sudo().query.PetPlace.updateOne({
          where: { id: place.id },
          data: {
            verified: true,
            claimStatus: PET_PLACE_CLAIM_STATUS.VERIFIED,
            verifiedAt: new Date().toISOString(),
          },
        });
        return {
          success: true,
          message: "Ficha verificada. El dueño ya puede editarla.",
          claimStatus: PET_PLACE_CLAIM_STATUS.VERIFIED,
          verified: true,
        };
      }

      await context.sudo().query.PetPlace.updateOne({
        where: { id: place.id },
        data: {
          verified: false,
          claimStatus: PET_PLACE_CLAIM_STATUS.REJECTED,
          verifiedAt: null,
          user: { disconnect: true },
        },
      });
      return {
        success: true,
        message: "Solicitud rechazada. La ficha vuelve a estar disponible.",
        claimStatus: PET_PLACE_CLAIM_STATUS.REJECTED,
        verified: false,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar la verificación.",
        claimStatus: null,
        verified: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
