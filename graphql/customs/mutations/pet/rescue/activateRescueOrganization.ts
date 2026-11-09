import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import {
  RESCUE_MEMBER_ROLE,
  RESCUE_ORG_LIMITS,
  RESCUE_ORG_STATUS,
  RESCUE_ORG_TYPE_OPTIONS,
} from "../../../../../models/Pet/RescueOrganization/constants";
import { normalizeRescueOrgProfile } from "../../../../../models/Pet/RescueOrganization/RescueOrganization.rules";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { logActivity } from "../../../../../utils/activity/logActivity";
import { notify } from "../../../../../utils/notifications/notify";

const typeDefs = ``;

const definition = `
  activateRescueOrganization(input: RescueOrganizationCreateInput!): RescueOrganizationResult!
`;

type Input = {
  name: string;
  type: string;
  city?: string | null;
  state?: string | null;
  species?: string[] | null;
  description?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
};

const TYPE_LABEL = Object.fromEntries(RESCUE_ORG_TYPE_OPTIONS.map((option) => [option.value, option.label]));

function failure(message: string) {
  return { success: false, message, organization: null };
}

const resolver = {
  /**
   * Activa un espacio de rescate: crea la organización «En revisión» con quien llama como admin y
   * avisa a los admins de Kadesh para validarla por WhatsApp. El logo y la portada se suben
   * después con `updateRescueOrganization` (upload de Keystone).
   */
  activateRescueOrganization: async (_root: unknown, { input }: { input: Input }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId) return failure("Inicia sesión para activar tu espacio de rescate.");

    const { data, errors } = normalizeRescueOrgProfile({
      name: input.name,
      type: input.type,
      city: input.city ?? "",
      state: input.state ?? "",
      species: input.species ?? [],
      description: input.description ?? "",
      whatsapp: input.whatsapp ?? "",
      email: input.email ?? "",
      facebookUrl: input.facebookUrl ?? "",
      instagramUrl: input.instagramUrl ?? "",
      tiktokUrl: input.tiktokUrl ?? "",
      websiteUrl: input.websiteUrl ?? "",
    });
    if (errors.length) return failure(errors[0]);
    if (!data.whatsapp) return failure("Escribe un WhatsApp: ahí te contactamos para verificar tu espacio.");

    try {
      const sudo = context.sudo();
      if (!isPlatformAdmin(context.session)) {
        const created = await sudo.query.RescueOrganization.count({
          where: { createdBy: { id: { equals: userId } } },
        });
        if (created >= RESCUE_ORG_LIMITS.MAX_CREATED_PER_USER) {
          return failure("Ya activaste el máximo de espacios de rescate. Escríbenos si necesitas otro.");
        }
      }

      const organization = (await sudo.query.RescueOrganization.createOne({
        data: {
          ...data,
          status: RESCUE_ORG_STATUS.PENDING,
          createdBy: { connect: { id: userId } },
        },
        query: "id name slug type city state",
      })) as { id: string; name: string; slug: string | null; type: string; city?: string; state?: string };

      await sudo.query.RescueOrganizationMember.createOne({
        data: {
          organization: { connect: { id: organization.id } },
          user: { connect: { id: userId } },
          role: RESCUE_MEMBER_ROLE.ADMIN,
        },
      });

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_CREATED,
        summary: `Activó el espacio de rescate "${organization.name.slice(0, 80)}"`,
        entityType: "RescueOrganization",
        entityId: organization.id,
        metadata: { type: organization.type, city: organization.city ?? null },
      });
      void notify(context, {
        audience: "platform_admins",
        product: "pet",
        type: NOTIFICATION_TYPE.RESCUE_SUBMITTED,
        title: `Espacio de rescate por verificar: ${organization.name}`,
        body: [TYPE_LABEL[organization.type] ?? organization.type, organization.city, organization.state]
          .filter(Boolean)
          .join(" · "),
        entityType: "RescueOrganization",
        entityId: organization.id,
        metadata: { slug: organization.slug },
      });

      return {
        success: true,
        message: "¡Listo! Tu espacio de rescate está activo y en revisión.",
        organization: await context.db.RescueOrganization.findOne({ where: { id: organization.id } }),
      };
    } catch (error) {
      console.error("[activateRescueOrganization]", error);
      return failure("No pudimos activar tu espacio. Intenta de nuevo en un momento.");
    }
  },
};

export default { typeDefs, definition, resolver };
