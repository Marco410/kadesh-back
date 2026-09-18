import { KeystoneContext } from "@keystone-6/core/types";
import { PET_PLACE_APPOINTMENT_STATUS } from "../../../../../models/Pet/PetPlace/PetPlaceAppointment/status";
import { requireOwnedVerifiedPlace } from "./ownedPlace";

const typeDefs = `
  input CreateClinicAppointmentInput {
    petPlaceId: String!
    customerId: ID!
    startsAt: String!
    endsAt: String!
    serviceId: ID
    petName: String
    petSpecies: String
    notes: String
  }

  type CreateClinicAppointmentResult {
    success: Boolean!
    message: String!
    appointmentId: String
  }
`;

const definition = `
  createClinicAppointment(input: CreateClinicAppointmentInput!): CreateClinicAppointmentResult!
`;

const resolver = {
  createClinicAppointment: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        petPlaceId: string;
        customerId: string;
        startsAt: string;
        endsAt: string;
        serviceId?: string | null;
        petName?: string | null;
        petSpecies?: string | null;
        notes?: string | null;
      };
    },
    context: KeystoneContext,
  ) => {
    const owned = await requireOwnedVerifiedPlace(
      context,
      input.petPlaceId,
      "id verified claimStatus user { id } patients { id }",
    );
    if ("success" in owned) {
      return { ...owned, appointmentId: null };
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return {
        success: false,
        message: "Revisa la hora de la cita.",
        appointmentId: null,
      };
    }
    if (endsAt <= startsAt) {
      return {
        success: false,
        message: "La hora de fin debe ser posterior a la de inicio.",
        appointmentId: null,
      };
    }

    const startDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (startDay < todayDay) {
      return {
        success: false,
        message: "No puedes agendar en un día anterior.",
        appointmentId: null,
      };
    }

    const patientIds = ((owned.place as { patients?: { id: string }[] }).patients ?? []).map(
      (row) => row.id,
    );
    if (!patientIds.includes(input.customerId)) {
      return {
        success: false,
        message: "Primero da de alta al paciente en esta clínica.",
        appointmentId: null,
      };
    }

    try {
      const created = (await context.query.PetPlaceAppointment.createOne({
        data: {
          pet_place: { connect: { id: input.petPlaceId } },
          customer: { connect: { id: input.customerId } },
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: PET_PLACE_APPOINTMENT_STATUS.CONFIRMED,
          ...(input.serviceId ? { service: { connect: { id: input.serviceId } } } : {}),
          petName: (input.petName ?? "").trim(),
          petSpecies: (input.petSpecies ?? "").trim(),
          notes: (input.notes ?? "").trim(),
        },
        query: "id",
      })) as { id: string };

      return {
        success: true,
        message: "Cita agendada.",
        appointmentId: created.id,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.split("\n")[0]
          : "No pudimos agendar la cita.";
      return {
        success: false,
        message,
        appointmentId: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
