import { graphql, list } from "@keystone-6/core";
import { relationship, select, timestamp, virtual } from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { RESCUE_MEMBER_ROLE, RESCUE_MEMBER_ROLE_OPTIONS, RESCUE_PROFILE_EDITOR_ROLES } from "../constants";
import { findRescueMemberRole, rescueOrganizationMemberAccess } from "../RescueOrganization.access";

/**
 * Valida que una persona no se repita en la misma organización. Por API solo escribe un admin de
 * plataforma; el equipo pasa por las mutaciones de `graphql/customs/mutations/pet/rescue/`.
 */
async function validateMember({
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
  const organizationId: string | undefined = resolvedData.organization?.connect?.id ?? item?.organizationId ?? undefined;
  const userId: string | undefined = resolvedData.user?.connect?.id ?? item?.userId ?? undefined;
  if (!organizationId || !userId) {
    addValidationError("Indica la organización y la persona.");
    return;
  }
  const others = await context.sudo().query.RescueOrganizationMember.count({
    where: {
      organization: { id: { equals: organizationId } },
      user: { id: { equals: userId } },
      ...(item?.id ? { id: { not: { equals: item.id } } } : {}),
    },
  });
  if (others > 0) addValidationError("Esa persona ya es parte del equipo.");
}

async function loadUser(context: KeystoneContext, userId: string | null | undefined) {
  if (!userId) return null;
  return (await context.sudo().query.User.findOne({
    where: { id: userId },
    query: "name lastName email",
  })) as { name?: string | null; lastName?: string | null; email?: string | null } | null;
}

export default list({
  access: rescueOrganizationMemberAccess,
  hooks: { validateInput: validateMember as any },
  ui: {
    listView: { initialColumns: ["organization", "user", "role", "createdAt"] },
  },
  fields: {
    organization: relationship({ ref: "RescueOrganization.members", many: false }),
    user: relationship({ ref: "User", many: false }),
    role: select({
      type: "string",
      options: RESCUE_MEMBER_ROLE_OPTIONS,
      defaultValue: RESCUE_MEMBER_ROLE.VOLUNTEER,
      validation: { isRequired: true },
    }),
    /** Solo el nombre: el equipo se ve entre sí sin poder leer el `User` de los demás. */
    userName: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context: KeystoneContext) {
          const user = await loadUser(context, item?.userId);
          return [user?.name, user?.lastName].filter(Boolean).join(" ");
        },
      }),
    }),
    /** El correo, solo para quien administra el equipo (admin o coordinador) o un admin de plataforma. */
    userEmail: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context: KeystoneContext) {
          if (!item?.userId || !item?.organizationId) return null;
          if (!isPlatformAdmin(context.session)) {
            const viewerId = getSessionUserId(context.session);
            if (!viewerId) return null;
            if (viewerId !== item.userId) {
              const role = await findRescueMemberRole(context, String(item.organizationId), viewerId);
              if (!role || !RESCUE_PROFILE_EDITOR_ROLES.includes(role)) return null;
            }
          }
          return (await loadUser(context, item.userId))?.email ?? null;
        },
      }),
    }),
    /** ¿Esta fila es de quien consulta? */
    isViewer: virtual({
      field: graphql.field({
        type: graphql.nonNull(graphql.Boolean),
        resolve(item: any, _args, context: KeystoneContext) {
          const viewerId = getSessionUserId(context.session);
          return Boolean(viewerId && item?.userId === viewerId);
        },
      }),
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
  },
});
