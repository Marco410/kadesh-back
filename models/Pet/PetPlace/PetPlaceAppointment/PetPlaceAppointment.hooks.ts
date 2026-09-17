import { sendPetPlaceAppointmentEmail } from "../../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../../utils/intregrations/smtpMail";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { PET_PLACE_APPOINTMENT_STATUS } from "./status";

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
    if (startsAt && new Date(startsAt) < new Date()) {
      addValidationError("No puedes agendar una cita en el pasado.");
    }

    const sessionUserId = getSessionUserId(context.session);
    if (!isPlatformAdmin(context.session)) {
      const connectId = resolvedData.customer?.connect?.id;
      if (!sessionUserId) {
        addValidationError("Inicia sesión para reservar una cita.");
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

      if (operation === "create") {
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
