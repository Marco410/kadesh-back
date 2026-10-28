import { sendPetPlaceAppointmentEmail } from "../../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../../utils/intregrations/smtpMail";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { PET_PLACE_APPOINTMENT_STATUS } from "./status";
import { isSudoContext } from "../../../../utils/activity/listActivityHooks";
import { ANIMAL_TYPE_OPTIONS } from "../../../../utils/constants/constants";
import { findPetOwnerRole } from "../../Pet.access";

async function loadPlaceForCreate(context: any, petPlaceId: string | undefined) {
  if (!petPlaceId) return null;
  return context.sudo().query.PetPlace.findOne({
    where: { id: petPlaceId },
    query: "id verified user { id } patients { id }",
  }) as Promise<{
    id: string;
    verified: boolean | null;
    user: { id: string } | null;
    patients?: { id: string }[] | null;
  } | null>;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export const petPlaceAppointmentValidateInput = async ({
  resolvedData,
  item,
  operation,
  context,
  addValidationError,
}: any) => {
  const startsAt = resolvedData.startsAt ?? item?.startsAt;
  const endsAt = resolvedData.endsAt ?? item?.endsAt;

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    addValidationError("La fecha de fin debe ser posterior a la de inicio.");
  }

  if (operation === "create") {
    const sessionUserId = getSessionUserId(context.session);
    const petPlaceId = resolvedData.pet_place?.connect?.id as string | undefined;
    const place = await loadPlaceForCreate(context, petPlaceId);
    const isOwner =
      Boolean(sessionUserId) &&
      Boolean(place?.verified) &&
      place?.user?.id === sessionUserId;

    if (startsAt && new Date(startsAt) < new Date()) {
      if (!isOwner) {
        addValidationError("No puedes agendar una cita en el pasado.");
      } else if (startOfDay(new Date(startsAt)) < startOfDay(new Date())) {
        addValidationError("No puedes agendar una cita en un día anterior.");
      }
    }

    if (!isPlatformAdmin(context.session)) {
      const connectId = resolvedData.customer?.connect?.id as string | undefined;
      if (!sessionUserId) {
        addValidationError("Inicia sesión para reservar una cita.");
      } else if (isOwner) {
        if (!connectId) {
          addValidationError("Elige un paciente para esta cita.");
        } else if (connectId !== sessionUserId) {
          const isPatient = (place?.patients ?? []).some(
            (patient) => patient.id === connectId,
          );
          if (!isPatient) {
            addValidationError("El paciente no está dado de alta en esta clínica.");
          }
        }
      } else if (connectId && connectId !== sessionUserId) {
        addValidationError("No puedes reservar a nombre de otro usuario.");
      } else if (!connectId) {
        resolvedData.customer = { connect: { id: sessionUserId } };
      }
    }
  }

  return resolvedData;
};

export const petPlaceAppointmentEmailHook = {
  afterOperation: async (args: any) => {
    const { operation, item, inputData, context } = args;
    if (!item?.id) return;
    if (operation !== "create" && operation !== "update") return;

    try {
      if (!isSmtpConfigured()) return;

      const appointment = (await context.sudo().query.PetPlaceAppointment.findOne({
        where: { id: item.id },
        query: `
          id startsAt endsAt status petName
          pet_place { id name user { id name lastName email } }
          customer { id name lastName email }
        `,
      })) as any;

      if (!appointment) return;

      const ownerName =
        [appointment.pet_place?.user?.name, appointment.pet_place?.user?.lastName]
          .filter(Boolean)
          .join(" ") || "ahí";
      const customerName =
        [appointment.customer?.name, appointment.customer?.lastName]
          .filter(Boolean)
          .join(" ") || "Un cliente";
      const petPlaceName = appointment.pet_place?.name ?? "tu negocio";
      const sessionUserId = getSessionUserId(context.session);
      const createdByOwner =
        Boolean(sessionUserId) &&
        sessionUserId === appointment.pet_place?.user?.id;

      if (operation === "create") {
        if (createdByOwner) {
          if (appointment.customer?.email) {
            await sendPetPlaceAppointmentEmail({
              to: appointment.customer.email,
              audience: "customer",
              ownerName,
              petPlaceName,
              customerName,
              petName: appointment.petName,
              startsAt: appointment.startsAt,
              endsAt: appointment.endsAt,
              status: appointment.status,
            });
          }
        } else {
          const ownerEmail = appointment.pet_place?.user?.email;
          if (ownerEmail) {
            await sendPetPlaceAppointmentEmail({
              to: ownerEmail,
              audience: "owner",
              ownerName,
              petPlaceName,
              customerName,
              petName: appointment.petName,
              startsAt: appointment.startsAt,
              endsAt: appointment.endsAt,
              status: appointment.status,
            });
          }
        }
      }

      if (
        operation === "update" &&
        inputData &&
        Object.prototype.hasOwnProperty.call(inputData, "status") &&
        [
          PET_PLACE_APPOINTMENT_STATUS.CONFIRMED,
          PET_PLACE_APPOINTMENT_STATUS.CANCELLED,
        ].includes(appointment.status) &&
        appointment.customer?.email
      ) {
        await sendPetPlaceAppointmentEmail({
          to: appointment.customer.email,
          audience: "customer",
          ownerName,
          petPlaceName,
          customerName,
          petName: appointment.petName,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
        });
      }
    } catch (error) {
      console.error("[PetPlaceAppointment] Error en hook de correo:", error);
    }
  },
};

/**
 * Cita ligada a una mascota de la cartilla: si `petName`/`petSpecies` vienen vacíos se llenan
 * desde `Pet`, porque la veterinaria no puede leer la cartilla y sigue viendo esos textos.
 */
export const petPlaceAppointmentPetResolveInput = async ({ resolvedData, item, context }: any) => {
  const petId = resolvedData.pet?.connect?.id as string | undefined;
  if (!petId) return resolvedData;
  const nameEmpty = !String(resolvedData.petName ?? item?.petName ?? "").trim();
  const speciesEmpty = !String(resolvedData.petSpecies ?? item?.petSpecies ?? "").trim();
  if (!nameEmpty && !speciesEmpty) return resolvedData;

  const pet = (await context.sudo().query.Pet.findOne({
    where: { id: petId },
    query: "name animal_type { name } animal_breed { breed }",
  })) as {
    name?: string | null;
    animal_type?: { name?: string | null } | null;
    animal_breed?: { breed?: string | null } | null;
  } | null;
  if (!pet) return resolvedData;

  const data = { ...resolvedData };
  if (nameEmpty && pet.name) data.petName = pet.name;
  if (speciesEmpty) {
    const typeLabel = ANIMAL_TYPE_OPTIONS.find((option) => option.value === pet.animal_type?.name)?.label;
    const species = [typeLabel, pet.animal_breed?.breed].filter(Boolean).join(" - ");
    if (species) data.petSpecies = species;
  }
  return data;
};

/** La mascota de la cita debe ser del cliente de la cita (la reserve él o su veterinaria). */
export const petPlaceAppointmentPetValidateInput = async ({
  resolvedData,
  item,
  context,
  addValidationError,
}: any) => {
  const petId = resolvedData.pet?.connect?.id as string | undefined;
  if (!petId || isSudoContext(context) || isPlatformAdmin(context.session)) return;
  const customerId =
    (resolvedData.customer?.connect?.id as string | undefined) ??
    (item?.customerId as string | undefined) ??
    getSessionUserId(context.session) ??
    undefined;
  if (!customerId || !(await findPetOwnerRole(context, petId, customerId))) {
    addValidationError("La mascota no es del cliente de esta cita.");
  }
};
