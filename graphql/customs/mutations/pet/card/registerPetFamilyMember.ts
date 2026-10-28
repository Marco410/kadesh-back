import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_OWNER_ROLE } from "../../../../../models/Pet/constants";
import { findPetOwnerRole } from "../../../../../models/Pet/Pet.access";
import { PRODUCT } from "../../../../../utils/constants/product";
import { sendPetFamilyAccountEmail } from "../../../../../utils/helpers/sendgrid";
import { normalizeMxPhone } from "../../../../../utils/pet/phone";
import { petCardUrl, requirePetOwner } from "../../../../../utils/pet/petCard";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Igual que el registro de la web. */
const MIN_PASSWORD_LENGTH = 8;

const typeDefs = `
  input RegisterPetFamilyMemberInput {
    name: String!
    lastName: String
    email: String!
    phone: String
    password: String!
  }

  type RegisterPetFamilyMemberResult {
    id: ID!
    role: String!
    userName: String!
    createdAccount: Boolean!
  }
`;

const definition = `
  registerPetFamilyMember(petId: ID!, input: RegisterPetFamilyMemberInput!): RegisterPetFamilyMemberResult!
`;

type Input = {
  name: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  password: string;
};

function displayName(user: { name?: string | null; lastName?: string | null } | null): string {
  return [user?.name, user?.lastName].filter(Boolean).join(" ").trim();
}

const resolver = {
  /**
   * El dueño principal registra a un familiar que aún no tiene cuenta: crea la cuenta con la
   * contraseña que él elige, lo agrega como `family` y le manda un correo que le dice que esa
   * contraseña la tiene quien lo registró (el correo nunca la lleva). Si el correo ya tenía
   * cuenta, solo lo agrega y no toca su contraseña.
   */
  registerPetFamilyMember: async (
    _root: unknown,
    { petId, input }: { petId: string; input: Input },
    context: KeystoneContext,
  ) => {
    try {
      const { userId: inviterId } = await requirePetOwner(context, petId, { principal: true });

      const name = (input.name ?? "").trim();
      const lastName = (input.lastName ?? "").trim();
      const email = (input.email ?? "").trim().toLowerCase();
      const password = input.password ?? "";
      if (!name) throw new GraphQLError("Escribe su nombre.");
      if (!EMAIL_PATTERN.test(email)) throw new GraphQLError("Escribe un correo válido.");
      let phone = "";
      if (input.phone?.trim()) {
        const normalized = normalizeMxPhone(input.phone);
        if (!normalized.ok) throw new GraphQLError(normalized.reason);
        phone = normalized.digits;
      }

      const sudo = context.sudo();
      const [existing] = (await sudo.query.User.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        query: "id",
        take: 1,
      })) as Array<{ id: string }>;

      let memberId = existing?.id ?? "";
      if (memberId) {
        if (await findPetOwnerRole(context, petId, memberId)) {
          throw new GraphQLError("Esa persona ya es dueña de esta mascota.");
        }
      } else {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new GraphQLError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        }
        const created = (await sudo.query.User.createOne({
          data: { name, lastName, email, phone, password, product: PRODUCT.PET },
          query: "id",
        })) as { id: string };
        memberId = created.id;
      }

      const row = (await sudo.query.PetOwner.createOne({
        data: {
          pet: { connect: { id: petId } },
          user: { connect: { id: memberId } },
          role: PET_OWNER_ROLE.FAMILY,
        },
        query: "id role userName",
      })) as { id: string; role: string; userName?: string | null };

      if (!existing) {
        try {
          const [inviter, pet] = await Promise.all([
            sudo.query.User.findOne({ where: { id: inviterId }, query: "name lastName" }),
            sudo.query.Pet.findOne({ where: { id: petId }, query: "name" }),
          ]);
          await sendPetFamilyAccountEmail({
            to: email,
            displayName: displayName({ name, lastName }) || "Hola",
            inviterName: displayName(inviter as { name?: string; lastName?: string } | null) || "Tu familiar",
            petName: (pet as { name?: string } | null)?.name || "tu mascota",
            url: petCardUrl(petId),
          });
        } catch (error) {
          console.error("[pet] No se pudo mandar el correo al familiar registrado", { petId }, error);
        }
      }

      return {
        id: row.id,
        role: row.role,
        userName: row.userName ?? "",
        createdAccount: !existing,
      };
    } catch (error) {
      console.error("[pet] registerPetFamilyMember", error);
      if (error instanceof GraphQLError) throw error;
      throw new GraphQLError("No se pudo registrar a esta persona. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
