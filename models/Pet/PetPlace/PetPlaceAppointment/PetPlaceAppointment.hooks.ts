import { sendPetPlaceAppointmentEmail } from "../../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../../utils/intregrations/smtpMail";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { PET_PLACE_APPOINTMENT_STATUS } from "./status";

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
