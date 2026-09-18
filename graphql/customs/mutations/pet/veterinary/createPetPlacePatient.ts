import { KeystoneContext } from "@keystone-6/core/types";
import { requireOwnedVerifiedPlace } from "./ownedPlace";

const PHONE_PATTERN = /^\+?\d{10,}$/;
const EMAIL_PATTERN =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const typeDefs = `
  input CreatePetPlacePatientInput {
    petPlaceId: String!
    name: String!
    lastName: String
    phone: String
    email: String
  }

  type PetPlacePatient {
    id: ID!
    name: String
    lastName: String
    phone: String
    email: String
  }

  type CreatePetPlacePatientResult {
    success: Boolean!
    message: String!
    created: Boolean!
    patient: PetPlacePatient
  }
`;

const definition = `
  createPetPlacePatient(input: CreatePetPlacePatientInput!): CreatePetPlacePatientResult!
`;

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

const resolver = {
  createPetPlacePatient: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        petPlaceId: string;
        name: string;
        lastName?: string | null;
        phone?: string | null;
        email?: string | null;
      };
    },
    context: KeystoneContext,
  ) => {
    const owned = await requireOwnedVerifiedPlace(
      context,
      input.petPlaceId,
      "id name verified claimStatus user { id } patients { id }",
    );
    if ("success" in owned) {
      return { ...owned, created: false, patient: null };
    }

    const name = (input.name ?? "").trim();
    if (!name) {
      return {
        success: false,
        message: "Escribe el nombre del paciente.",
        created: false,
        patient: null,
      };
    }

    const lastName = (input.lastName ?? "").trim();
    const phone = normalizePhone(input.phone ?? "");
    const email = (input.email ?? "").trim().toLowerCase();

    if (phone && !PHONE_PATTERN.test(phone)) {
      return {
        success: false,
        message: "El teléfono debe tener al menos 10 dígitos.",
        created: false,
        patient: null,
      };
    }

    if (email && !EMAIL_PATTERN.test(email)) {
      return {
        success: false,
        message: "El correo no tiene un formato válido.",
        created: false,
        patient: null,
      };
    }

    const { place } = owned;
    const patientQuery = "id name lastName phone email";

    if (email) {
      const existing = (await context.sudo().query.User.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        take: 1,
        query: patientQuery,
      })) as Array<{
        id: string;
        name: string | null;
        lastName: string | null;
        phone: string | null;
        email: string | null;
      }>;

      const user = existing[0];
      if (user) {
        const already = ((place as { patients?: { id: string }[] }).patients ?? []).some(
          (row) => row.id === user.id,
        );
        if (!already) {
          await context.sudo().query.PetPlace.updateOne({
            where: { id: place.id },
            data: { patients: { connect: [{ id: user.id }] } },
          });
        }
        return {
          success: true,
          message: already
            ? "Esa persona ya está en tu lista de pacientes."
            : "Encontramos su cuenta y la ligamos a esta clínica.",
          created: false,
          patient: user,
        };
      }
    }

    const created = (await context.sudo().query.User.createOne({
      data: {
        name,
        lastName,
        phone,
        ...(email ? { email } : {}),
        clinic_patients_of: { connect: [{ id: place.id }] },
      },
      query: patientQuery,
    })) as {
      id: string;
      name: string | null;
      lastName: string | null;
      phone: string | null;
      email: string | null;
    };

    return {
      success: true,
      message: "Paciente dado de alta.",
      created: true,
      patient: created,
    };
  },
};

export default { typeDefs, definition, resolver };
