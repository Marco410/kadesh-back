import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { PET_PLACE_CLAIM_STATUS } from "../../../../../models/PetPlace/claim";

const PHONE_PATTERN = /^\+?\d{10,}$/;
const SOCIAL_MEDIA_OPTIONS = ["Facebook", "Instagram", "X", "LinkedIn", "TikTok"] as const;

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

type OwnedPlace = {
  id: string;
  verified: boolean | null;
  claimStatus: string | null;
  user: { id: string } | null;
};

const typeDefs = `
  input UpdateMyPetPlaceInput {
    petPlaceId: String!
    name: String
    description: String
    phone: String
    whatsapp: String
    website: String
    street: String
    municipality: String
    state: String
    country: String
    cp: String
    address: String
    emergencies: Boolean
    email: String
    parking: Boolean
    appointmentRequired: Boolean
    socialMedia: [PetPlaceSocialMediaInput!]
  }

  input PetPlaceSocialMediaInput {
    social_media: String!
    link: String!
  }

  type UpdateMyPetPlaceResult {
    success: Boolean!
    message: String!
    petPlaceId: String
  }
`;

const definition = `
  updateMyPetPlace(input: UpdateMyPetPlaceInput!): UpdateMyPetPlaceResult!
`;

const resolver = {
  updateMyPetPlace: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        petPlaceId: string;
        name?: string | null;
        description?: string | null;
        phone?: string | null;
        whatsapp?: string | null;
        website?: string | null;
        street?: string | null;
        municipality?: string | null;
        state?: string | null;
        country?: string | null;
        cp?: string | null;
        address?: string | null;
        emergencies?: boolean | null;
        email?: string | null;
        parking?: boolean | null;
        appointmentRequired?: boolean | null;
        socialMedia?: Array<{ social_media: string; link: string }> | null;
      };
    },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId) {
      return {
        success: false,
        message: "Inicia sesión para editar tu clínica.",
        petPlaceId: null,
      };
    }

    const place = (await context.sudo().query.PetPlace.findOne({
      where: { id: input.petPlaceId },
      query: "id verified claimStatus user { id }",
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
          : "Solo el dueño verificado puede editar esta ficha.",
        petPlaceId: place.id,
      };
    }

    const data: Record<string, unknown> = {};
    const assignText = (key: string, value: string | null | undefined) => {
      if (value === undefined) return;
      data[key] = (value ?? "").trim();
    };

    if (input.name !== undefined) {
      const name = input.name?.trim() ?? "";
      if (!name) {
        return {
          success: false,
          message: "El nombre de la clínica no puede quedar vacío.",
          petPlaceId: place.id,
        };
      }
      data.name = name;
    }

    if (input.description !== undefined) {
      const description = input.description?.trim() ?? "";
      if (!description) {
        return {
          success: false,
          message: "Escribe una descripción de la clínica.",
          petPlaceId: place.id,
        };
      }
      data.description = description;
    }

    if (input.phone !== undefined) {
      const phone = normalizePhone(input.phone ?? "");
      if (phone && !PHONE_PATTERN.test(phone)) {
        return {
          success: false,
          message: "El teléfono debe ser de 10 dígitos.",
          petPlaceId: place.id,
        };
      }
      data.phone = phone;
    }

    if (input.whatsapp !== undefined) {
      const whatsapp = normalizePhone(input.whatsapp ?? "");
      if (whatsapp && !PHONE_PATTERN.test(whatsapp)) {
        return {
          success: false,
          message: "El WhatsApp debe ser de 10 dígitos.",
          petPlaceId: place.id,
        };
      }
      data.whatsapp = whatsapp;
    }

    assignText("website", input.website);
    assignText("street", input.street);
    assignText("municipality", input.municipality);
    assignText("state", input.state);
    assignText("country", input.country);
    assignText("cp", input.cp);
    assignText("address", input.address);

    if (input.email !== undefined) {
      const email = (input.email ?? "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
          success: false,
          message: "El correo de la clínica no es válido.",
          petPlaceId: place.id,
        };
      }
      data.email = email;
    }

    if (input.emergencies !== undefined && input.emergencies !== null) {
      data.emergencies = input.emergencies;
    }
    if (input.parking !== undefined && input.parking !== null) {
      data.parking = input.parking;
    }
    if (
      input.appointmentRequired !== undefined &&
      input.appointmentRequired !== null
    ) {
      data.appointmentRequired = input.appointmentRequired;
    }

    const socialMedia = input.socialMedia;
    const hasSocialUpdate = socialMedia !== undefined && socialMedia !== null;

    if (Object.keys(data).length === 0 && !hasSocialUpdate) {
      return {
        success: true,
        message: "No había cambios que guardar.",
        petPlaceId: place.id,
      };
    }

    try {
      if (Object.keys(data).length > 0) {
        await context.sudo().query.PetPlace.updateOne({
          where: { id: place.id },
          data,
        });
      }

      if (hasSocialUpdate) {
        const existing = (await context.sudo().query.SocialMedia.findMany({
          where: { pet_place: { id: { equals: place.id } } },
          query: "id",
        })) as Array<{ id: string }>;

        if (existing.length > 0) {
          await context.sudo().query.SocialMedia.deleteMany({
            where: existing.map((item) => ({ id: item.id })),
          });
        }

        const rows = (socialMedia ?? []).filter((item) => {
          const link = item.link?.trim() ?? "";
          return (
            Boolean(link) &&
            SOCIAL_MEDIA_OPTIONS.includes(
              item.social_media as (typeof SOCIAL_MEDIA_OPTIONS)[number],
            )
          );
        });

        for (const row of rows) {
          await context.sudo().query.SocialMedia.createOne({
            data: {
              social_media: row.social_media,
              link: row.link.trim(),
              pet_place: { connect: { id: place.id } },
            },
          });
        }
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No pudimos guardar los cambios.",
        petPlaceId: place.id,
      };
    }

    return {
      success: true,
      message: "Datos actualizados.",
      petPlaceId: place.id,
    };
  },
};

export default { typeDefs, definition, resolver };
