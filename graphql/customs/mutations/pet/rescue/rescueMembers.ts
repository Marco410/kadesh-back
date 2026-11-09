import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import {
  RESCUE_MEMBER_ROLE,
  RESCUE_MEMBER_ROLE_OPTIONS,
  RESCUE_MEMBER_ROLE_VALUES,
  RESCUE_ORG_LIMITS,
} from "../../../../../models/Pet/RescueOrganization/constants";
import {
  findRescueMemberRole,
  requireRescueRole,
} from "../../../../../models/Pet/RescueOrganization/RescueOrganization.access";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { logActivity } from "../../../../../utils/activity/logActivity";
import { notify } from "../../../../../utils/notifications/notify";
import {
  countRescueAdmins,
  displayName,
  petFrontendUrl,
  RESCUE_MEMBER_USER_NOT_FOUND,
  rescuePanelPath,
} from "./shared";

/**
 * Equipo de un espacio de rescate. Solo sus admins agregan, cambian de rol o quitan a alguien; cada
 * quien puede salirse. Nunca se queda una organización sin admin. Se agrega por correo a cuentas
 * que ya existen (no se crean cuentas a nombre de otros).
 */

const typeDefs = ``;

const definition = `
  addRescueOrganizationMember(organizationId: ID!, email: String!, role: String!): RescueMemberResult!
  setRescueOrganizationMemberRole(memberId: ID!, role: String!): RescueMemberResult!
  removeRescueOrganizationMember(memberId: ID!): RescueMemberResult!
`;

const ROLE_LABEL = Object.fromEntries(RESCUE_MEMBER_ROLE_OPTIONS.map((option) => [option.value, option.label]));

type MemberRow = {
  id: string;
  role: string;
  user?: { id: string } | null;
  organization?: { id: string; name: string } | null;
};

function failure(message: string, code: string | null = null) {
  return { success: false, message, code, member: null };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof GraphQLError) return error.message;
  return fallback;
}

async function loadMember(context: KeystoneContext, memberId: string): Promise<MemberRow | null> {
  return (await context.sudo().query.RescueOrganizationMember.findOne({
    where: { id: memberId },
    query: "id role user { id } organization { id name }",
  })) as MemberRow | null;
}

const resolver = {
  addRescueOrganizationMember: async (
    _root: unknown,
    { organizationId, email, role }: { organizationId: string; email: string; role: string },
    context: KeystoneContext,
  ) => {
    try {
      const { organization } = await requireRescueRole(context, organizationId, [RESCUE_MEMBER_ROLE.ADMIN]);
      if (!RESCUE_MEMBER_ROLE_VALUES.has(role)) return failure("Elige un rol para esta persona.");
      const clean = (email ?? "").trim().toLowerCase();
      if (!clean) return failure("Escribe el correo de la persona.");

      const sudo = context.sudo();
      const total = await sudo.query.RescueOrganizationMember.count({
        where: { organization: { id: { equals: organizationId } } },
      });
      if (total >= RESCUE_ORG_LIMITS.MAX_MEMBERS) {
        return failure(`Un espacio puede tener hasta ${RESCUE_ORG_LIMITS.MAX_MEMBERS} personas en su equipo.`);
      }

      const [user] = (await sudo.query.User.findMany({
        where: { email: { equals: clean, mode: "insensitive" } },
        query: "id name lastName",
        take: 1,
      })) as Array<{ id: string; name?: string | null; lastName?: string | null }>;
      if (!user) {
        return failure(
          "No encontramos una cuenta de KADESH con ese correo. Pídele que se registre y vuelve a intentarlo.",
          RESCUE_MEMBER_USER_NOT_FOUND,
        );
      }
      if (await findRescueMemberRole(context, organizationId, user.id)) {
        return failure("Esa persona ya es parte del equipo.");
      }

      const created = (await sudo.query.RescueOrganizationMember.createOne({
        data: {
          organization: { connect: { id: organizationId } },
          user: { connect: { id: user.id } },
          role,
        },
        query: "id",
      })) as { id: string };

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_MEMBER_ADDED,
        summary: `Agregó a alguien como ${ROLE_LABEL[role] ?? role} en "${organization.name.slice(0, 80)}"`,
        entityType: "RescueOrganization",
        entityId: organizationId,
        metadata: { memberId: created.id, role },
      });
      void notify(context, {
        audience: [user.id],
        product: "pet",
        type: NOTIFICATION_TYPE.RESCUE_MEMBER_ADDED,
        title: `Te agregaron al equipo de ${organization.name}`,
        body: `Tu rol: ${ROLE_LABEL[role] ?? role}. Ya puedes verlo en tu panel.`,
        entityType: "RescueOrganization",
        entityId: organizationId,
        url: petFrontendUrl(rescuePanelPath(organizationId)),
        metadata: { role },
      });

      return {
        success: true,
        message: `${displayName(user) || "La persona"} ya es parte del equipo.`,
        code: null,
        member: await context.db.RescueOrganizationMember.findOne({ where: { id: created.id } }),
      };
    } catch (error) {
      console.error("[addRescueOrganizationMember]", error);
      return failure(errorMessage(error, "No pudimos agregar a esta persona. Intenta de nuevo."));
    }
  },

  setRescueOrganizationMemberRole: async (
    _root: unknown,
    { memberId, role }: { memberId: string; role: string },
    context: KeystoneContext,
  ) => {
    try {
      if (!RESCUE_MEMBER_ROLE_VALUES.has(role)) return failure("Elige un rol válido.");
      const member = await loadMember(context, memberId);
      if (!member?.organization) return failure("No encontramos a esa persona en el equipo.");
      const { organization } = await requireRescueRole(context, member.organization.id, [RESCUE_MEMBER_ROLE.ADMIN]);
      if (member.role === role) {
        return {
          success: true,
          message: "Sin cambios.",
          code: null,
          member: await context.db.RescueOrganizationMember.findOne({ where: { id: memberId } }),
        };
      }
      if (member.role === RESCUE_MEMBER_ROLE.ADMIN && (await countRescueAdmins(context, organization.id)) <= 1) {
        return failure("El espacio necesita al menos un administrador. Nombra a otro antes de cambiar este rol.");
      }

      await context.sudo().query.RescueOrganizationMember.updateOne({ where: { id: memberId }, data: { role } });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_MEMBER_UPDATED,
        summary: `Cambió un rol a ${ROLE_LABEL[role] ?? role} en "${organization.name.slice(0, 80)}"`,
        entityType: "RescueOrganization",
        entityId: organization.id,
        metadata: { memberId, from: member.role, to: role },
      });
      return {
        success: true,
        message: "Rol actualizado.",
        code: null,
        member: await context.db.RescueOrganizationMember.findOne({ where: { id: memberId } }),
      };
    } catch (error) {
      console.error("[setRescueOrganizationMemberRole]", error);
      return failure(errorMessage(error, "No pudimos cambiar el rol. Intenta de nuevo."));
    }
  },

  /** Un admin quita a alguien del equipo, o cualquier miembro se sale (su propia fila). */
  removeRescueOrganizationMember: async (
    _root: unknown,
    { memberId }: { memberId: string },
    context: KeystoneContext,
  ) => {
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return failure("Inicia sesión para continuar.");
      const member = await loadMember(context, memberId);
      if (!member?.organization) return failure("No encontramos a esa persona en el equipo.");
      const organizationId = member.organization.id;
      const leaving = member.user?.id === userId;
      if (!leaving) await requireRescueRole(context, organizationId, [RESCUE_MEMBER_ROLE.ADMIN]);
      if (member.role === RESCUE_MEMBER_ROLE.ADMIN && (await countRescueAdmins(context, organizationId)) <= 1) {
        return failure(
          leaving
            ? "Eres el único administrador. Nombra a otro antes de salirte."
            : "El espacio necesita al menos un administrador.",
        );
      }

      await context.sudo().query.RescueOrganizationMember.deleteOne({ where: { id: memberId } });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_MEMBER_REMOVED,
        summary: leaving
          ? `Salió del espacio de rescate "${member.organization.name.slice(0, 80)}"`
          : `Quitó a alguien del espacio de rescate "${member.organization.name.slice(0, 80)}"`,
        entityType: "RescueOrganization",
        entityId: organizationId,
        metadata: { memberId, role: member.role, leaving },
      });
      return {
        success: true,
        message: leaving ? "Saliste del espacio de rescate." : "Listo, ya no es parte del equipo.",
        code: null,
        member: null,
      };
    } catch (error) {
      console.error("[removeRescueOrganizationMember]", error);
      return failure(errorMessage(error, "No pudimos quitar a esta persona. Intenta de nuevo."));
    }
  },
};

export default { typeDefs, definition, resolver };
