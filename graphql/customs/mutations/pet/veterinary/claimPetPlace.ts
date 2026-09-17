import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import {
  PET_PLACE_CLAIM_ROLE,
  PET_PLACE_CLAIM_STATUS,
  type PetPlaceClaimRole,
} from "../../../../../models/Pet/PetPlace/claim";

const PHONE_PATTERN = /^\+?\d{10,}$/;

const CLAIM_ROLES = new Set<string>(Object.values(PET_PLACE_CLAIM_ROLE));

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

type PetPlaceClaimRow = {
  id: string;
  name: string;
  verified: boolean | null;
  claimStatus: string | null;
  user: { id: string } | null;
};

const typeDefs = `
  input ClaimPetPlaceInput {
    petPlaceId: String!
    role: String!
    phone: String!
    notes: String
  }

  type ClaimPetPlaceResult {
    success: Boolean!
    message: String!
    claimStatus: String
    petPlaceId: String
  }
`;

const definition = `
  claimPetPlace(input: ClaimPetPlaceInput!): ClaimPetPlaceResult!
`;

const resolver = {
  claimPetPlace: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        petPlaceId: string;
        role: string;
        phone: string;
        notes?: string | null;
      };
    },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) {
      return {
        success: false,
        message: "Inicia sesión para reclamar esta ficha.",
        claimStatus: null,
        petPlaceId: null,
      };
    }

    const role = input.role?.trim();
    if (!role || !CLAIM_ROLES.has(role)) {
      return {
        success: false,
        message: "Elige si eres propietario, encargado o veterinario.",
        claimStatus: null,
        petPlaceId: null,
      };
    }

    const phone = normalizePhone(input.phone ?? "");
    if (!PHONE_PATTERN.test(phone)) {
      return {
        success: false,
        message: "El teléfono debe ser de 10 dígitos.",
        claimStatus: null,
        petPlaceId: null,
      };
    }

    const notes = input.notes?.trim() || "";

    const place = (await context.sudo().query.PetPlace.findOne({
      where: { id: input.petPlaceId },
      query: "id name verified claimStatus user { id }",
    })) as PetPlaceClaimRow | null;

    if (!place) {
      return {
        success: false,
        message: "No encontramos esta veterinaria.",
        claimStatus: null,
        petPlaceId: null,
      };
    }

    const status = place.claimStatus ?? PET_PLACE_CLAIM_STATUS.UNCLAIMED;
    const ownerId = place.user?.id ?? null;
    const isOwnPending =
      ownerId === userId &&
      (status === PET_PLACE_CLAIM_STATUS.PENDING ||
        status === PET_PLACE_CLAIM_STATUS.VERIFIED ||
        Boolean(place.verified));

    if (isOwnPending) {
      return {
        success: true,
        message:
          status === PET_PLACE_CLAIM_STATUS.VERIFIED || place.verified
            ? "Esta ficha ya está verificada y es tuya."
            : "Ya enviaste la solicitud. Sigue por WhatsApp para validarla.",
        claimStatus:
          place.verified || status === PET_PLACE_CLAIM_STATUS.VERIFIED
            ? PET_PLACE_CLAIM_STATUS.VERIFIED
            : PET_PLACE_CLAIM_STATUS.PENDING,
        petPlaceId: place.id,
      };
    }

    const takenByOther =
      ownerId &&
      ownerId !== userId &&
      (place.verified ||
        status === PET_PLACE_CLAIM_STATUS.PENDING ||
        status === PET_PLACE_CLAIM_STATUS.VERIFIED);

    if (takenByOther) {
      return {
        success: false,
        message:
          place.verified || status === PET_PLACE_CLAIM_STATUS.VERIFIED
            ? "Esta ficha ya tiene un dueño verificado."
            : "Esta ficha ya tiene una solicitud en revisión.",
        claimStatus: status,
        petPlaceId: place.id,
      };
    }

    try {
      await context.sudo().query.PetPlace.updateOne({
        where: { id: place.id },
        data: {
          user: { connect: { id: userId } },
          verified: false,
          claimStatus: PET_PLACE_CLAIM_STATUS.PENDING,
          claimRole: role as PetPlaceClaimRole,
          claimPhone: phone,
          claimNotes: notes,
          claimedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No pudimos enviar la solicitud. Intenta de nuevo.",
        claimStatus: null,
        petPlaceId: null,
      };
    }

    return {
      success: true,
      message:
        "Solicitud enviada. Mándanos tus datos por WhatsApp para validar que la clínica es tuya.",
      claimStatus: PET_PLACE_CLAIM_STATUS.PENDING,
      petPlaceId: place.id,
    };
  },
};

export default { typeDefs, definition, resolver };
