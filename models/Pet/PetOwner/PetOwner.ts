import { graphql, list } from "@keystone-6/core";
import { relationship, select, timestamp, virtual } from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";
import { petOwnerAccess } from "../Pet.access";
import { PET_OWNER_ROLE, PET_OWNER_ROLE_OPTIONS } from "../constants";

/**
 * Valida que cada mascota tenga exactamente un principal y que una persona no se repita. Por API
 * solo crea filas un admin; el resto pasa por la mascota (principal) o `addPetFamilyMember`.
 */
async function validatePetOwner({
  operation,
  resolvedData,
  item,
  context,
  addValidationError,
}: {
  operation: string;
  resolvedData: Record<string, any>;
  item?: any;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}) {
  if (operation !== "create" && operation !== "update") return;
  const petId: string | undefined = resolvedData.pet?.connect?.id ?? item?.petId ?? undefined;
  const userId: string | undefined = resolvedData.user?.connect?.id ?? item?.userId ?? undefined;
  const role: string = resolvedData.role ?? item?.role ?? PET_OWNER_ROLE.FAMILY;
  if (!petId || !userId) {
    addValidationError("Indica la mascota y la persona.");
    return;
  }
  const others = (await context.sudo().query.PetOwner.findMany({
    where: {
      pet: { id: { equals: petId } },
      ...(item?.id ? { id: { not: { equals: item.id } } } : {}),
    },
    query: "id role user { id }",
  })) as Array<{ id: string; role: string; user?: { id: string } | null }>;
  if (others.some((row) => row.user?.id === userId)) {
    addValidationError("Esa persona ya es dueña de esta mascota.");
  }
  if (role === PET_OWNER_ROLE.PRINCIPAL && others.some((row) => row.role === PET_OWNER_ROLE.PRINCIPAL)) {
    addValidationError("La mascota ya tiene un dueño principal.");
  }
}

export default list({
  access: petOwnerAccess,
  hooks: { validateInput: validatePetOwner },
  ui: {
    listView: { initialColumns: ["pet", "user", "role", "createdAt"] },
  },
  fields: {
    pet: relationship({
      ref: "Pet.owners",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    role: select({
      options: PET_OWNER_ROLE_OPTIONS,
      defaultValue: PET_OWNER_ROLE.FAMILY,
      validation: { isRequired: true },
    }),
    /**
     * Solo el nombre de la persona, para que la familia vea quién más es dueño sin poder leer su
     * `User` (correo y teléfono siguen bajo el acceso de `User`).
     */
    userName: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context: KeystoneContext) {
          if (!item?.userId) return "";
          const user = (await context.sudo().query.User.findOne({
            where: { id: item.userId },
            query: "name lastName",
          })) as { name?: string | null; lastName?: string | null } | null;
          return [user?.name, user?.lastName].filter(Boolean).join(" ");
        },
      }),
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
