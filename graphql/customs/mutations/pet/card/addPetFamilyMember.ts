import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_OWNER_ROLE } from "../../../../../models/Pet/constants";
import { findPetOwnerRole } from "../../../../../models/Pet/Pet.access";
import { requirePetOwner } from "../../../../../utils/pet/petCard";

/** `extensions.code` cuando el correo no tiene cuenta. */
export const PET_FAMILY_USER_NOT_FOUND = "PET_FAMILY_USER_NOT_FOUND";

const typeDefs = `
  type PetFamilyMemberResult {
    id: ID!
    role: String!
    userName: String!
  }
`;

const definition = `
  addPetFamilyMember(petId: ID!, email: String!): PetFamilyMemberResult!
`;

const resolver = {
  /**
   * El dueño principal agrega a un familiar por correo: nadie puede leer el `id` de otro `User`,
   * así que la búsqueda va con sudo y solo devuelve el nombre.
   */
  addPetFamilyMember: async (
    _root: unknown,
    { petId, email }: { petId: string; email: string },
    context: KeystoneContext,
  ) => {
    try {
      await requirePetOwner(context, petId, { principal: true });
      const clean = (email ?? "").trim().toLowerCase();
      if (!clean) throw new GraphQLError("Escribe el correo de la persona.");

      const sudo = context.sudo();
      const [user] = (await sudo.query.User.findMany({
        where: { email: { equals: clean, mode: "insensitive" } },
        query: "id",
        take: 1,
      })) as Array<{ id: string }>;
      if (!user) {
        // El front usa el código para ofrecer registrar a la persona (`registerPetFamilyMember`).
        throw new GraphQLError("No encontramos una cuenta de Kadesh con ese correo.", {
          extensions: { code: PET_FAMILY_USER_NOT_FOUND },
        });
      }
      if (await findPetOwnerRole(context, petId, user.id)) {
        throw new GraphQLError("Esa persona ya es dueña de esta mascota.");
      }

      const row = (await sudo.query.PetOwner.createOne({
        data: {
          pet: { connect: { id: petId } },
          user: { connect: { id: user.id } },
          role: PET_OWNER_ROLE.FAMILY,
        },
        query: "id role userName",
      })) as { id: string; role: string; userName?: string | null };
      return { id: row.id, role: row.role, userName: row.userName ?? "" };
    } catch (error) {
      console.error("[pet] addPetFamilyMember", error);
      if (error instanceof GraphQLError) throw error;
      const message = error instanceof Error ? error.message : "No se pudo agregar al familiar.";
      throw new GraphQLError(message);
    }
  },
};

export default { typeDefs, definition, resolver };
