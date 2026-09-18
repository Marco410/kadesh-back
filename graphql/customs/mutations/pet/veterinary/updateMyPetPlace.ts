import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { PET_PLACE_CLAIM_STATUS } from "../../../../../models/Pet/PetPlace/claim";
import {
  TYPES_PET_SHELTER,
  dayOfWeek,
} from "../../../../../utils/constants/constants";
import { ensurePetPlaceTypes } from "./ensurePetPlaceType";

const PHONE_PATTERN = /^\+?\d{10,}$/;
const SOCIAL_MEDIA_OPTIONS = ["Facebook", "Instagram", "X", "LinkedIn", "TikTok"] as const;
const TYPE_VALUES = new Set<string>(
  TYPES_PET_SHELTER.map((type) => type.value),
);
const DAY_VALUES = new Set<string>(Object.values(dayOfWeek));

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
    types: [String!]
    serviceIds: [ID!]
    schedules: [PetPlaceScheduleInput!]
  }

  input PetPlaceSocialMediaInput {
    social_media: String!
    link: String!
  }

  input PetPlaceScheduleInput {
    day: String!
    timeIni: Int!
    timeEnd: Int!
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
        types?: string[] | null;
        serviceIds?: string[] | null;
        schedules?: Array<{ day: string; timeIni: number; timeEnd: number }> | null;
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
    const typesInput = input.types;
    const serviceIdsInput = input.serviceIds;
    const schedulesInput = input.schedules;
    const hasSocialUpdate = socialMedia !== undefined && socialMedia !== null;
    const hasTypesUpdate = typesInput !== undefined && typesInput !== null;
    const hasServicesUpdate = serviceIdsInput !== undefined && serviceIdsInput !== null;
    const hasSchedulesUpdate =
      schedulesInput !== undefined && schedulesInput !== null;

    if (typesInput !== undefined && typesInput !== null) {
      const uniqueTypes = [...new Set(typesInput.map((value) => value.trim()))];
      if (uniqueTypes.length === 0) {
        return {
          success: false,
          message: "Elige al menos un tipo de negocio.",
          petPlaceId: place.id,
        };
      }
      if (uniqueTypes.some((value) => !TYPE_VALUES.has(value))) {
        return {
          success: false,
          message: "Hay un tipo de negocio que no reconocemos.",
          petPlaceId: place.id,
        };
      }

      const typeRows = await ensurePetPlaceTypes(context, uniqueTypes);

      if (typeRows.length !== uniqueTypes.length) {
        return {
          success: false,
          message: "Hay un tipo de negocio que no reconocemos.",
          petPlaceId: place.id,
        };
      }

      data.types = { set: typeRows.map((row) => ({ id: row.id })) };
    }

    if (serviceIdsInput !== undefined && serviceIdsInput !== null) {
      const uniqueIds = [...new Set(serviceIdsInput.filter(Boolean))];
      if (uniqueIds.length > 0) {
        const serviceRows = (await context.sudo().query.PetPlaceService.findMany({
          where: { id: { in: uniqueIds } },
          query: "id",
        })) as Array<{ id: string }>;
        if (serviceRows.length !== uniqueIds.length) {
          return {
            success: false,
            message: "Hay un servicio que ya no existe. Recarga e intenta de nuevo.",
            petPlaceId: place.id,
          };
        }
      }
      data.services = { set: uniqueIds.map((id) => ({ id })) };
    }

    if (schedulesInput !== undefined && schedulesInput !== null) {
      for (const row of schedulesInput) {
        if (!DAY_VALUES.has(row.day)) {
          return {
            success: false,
            message: "Hay un día de horario que no reconocemos.",
            petPlaceId: place.id,
          };
        }
        if (
          !Number.isInteger(row.timeIni) ||
          !Number.isInteger(row.timeEnd) ||
          row.timeIni < 0 ||
          row.timeIni > 23 ||
          row.timeEnd < 0 ||
          row.timeEnd > 23
        ) {
          return {
            success: false,
            message: "Los horarios deben ser horas entre 0 y 23.",
            petPlaceId: place.id,
          };
        }
        if (row.timeEnd <= row.timeIni) {
          return {
            success: false,
            message: "La hora de cierre debe ser posterior a la de apertura.",
            petPlaceId: place.id,
          };
        }
      }
    }

    if (
      Object.keys(data).length === 0 &&
      !hasSocialUpdate &&
      !hasSchedulesUpdate
    ) {
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

      if (schedulesInput !== undefined && schedulesInput !== null) {
        const existing = (await context.sudo().query.Schedule.findMany({
          where: { pet_place: { id: { equals: place.id } } },
          query: "id",
        })) as Array<{ id: string }>;

        if (existing.length > 0) {
          await context.sudo().query.Schedule.deleteMany({
            where: existing.map((item) => ({ id: item.id })),
          });
        }

        for (const row of schedulesInput) {
          await context.sudo().query.Schedule.createOne({
            data: {
              day: row.day,
              timeIni: row.timeIni,
              timeEnd: row.timeEnd,
              pet_place: { connect: { id: place.id } },
            },
          });
        }
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
