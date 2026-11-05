import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import {
  buildPetEventSlug,
  normalizePetEventInput,
  type PetEventInput,
  uniquePetEventSlug,
} from "../../../../../models/Pet/PetEvent/PetEvent.rules";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { notifyEventSubmitted } from "../../../../../utils/notifications/eventAlerts";
import {
  eventForCaller,
  failure,
  logPetEventActivity,
  type PetEventMutationResult,
  sendZoneAlertsIfDue,
} from "./shared";

const typeDefs = ``;

const definition = `
  submitPetEvent(input: PetEventInput!): PetEventMutationResult!
`;

const resolver = {
  /**
   * Publica un evento con sus fechas. Si no lo manda un admin queda «En revisión» y se avisa a los
   * admins; un admin lo publica directo (y avisa a la zona si la fecha está cerca). Las fotos se
   * suben después con `createPetEventMultimedia`. Límite: 5 al día por persona (RATE_LIMIT_RULES).
   */
  submitPetEvent: async (
    _root: unknown,
    { input }: { input: PetEventInput },
    context: KeystoneContext,
  ): Promise<PetEventMutationResult> => {
    const userId = getSessionUserId(context.session);
    if (!userId) return failure("Inicia sesión para publicar un evento.");
    const isAdmin = isPlatformAdmin(context.session);

    try {
      const normalized = await normalizePetEventInput(context, input, { isAdmin, userId });
      if (!normalized.ok) return failure(normalized.message);
      const { data, sessions } = normalized.value;

      const now = new Date().toISOString();
      const sudo = context.sudo();
      const slug = await uniquePetEventSlug(
        context,
        buildPetEventSlug(String(data.title), data.city as string | null),
      );
      const created = (await sudo.db.PetEvent.createOne({
        data: {
          ...data,
          slug,
          user: { connect: { id: userId } },
          status: isAdmin ? PET_EVENT_STATUS.APPROVED : PET_EVENT_STATUS.PENDING,
          ...(isAdmin
            ? { approvedAt: now, reviewedAt: now, reviewedBy: { connect: { id: userId } } }
            : {}),
        },
      })) as { id: string; title: string; slug: string | null; city: string; state: string };

      await sudo.db.PetEventSession.createMany({
        data: sessions.map((session) => ({
          event: { connect: { id: created.id } },
          startsAt: session.startsAt.toISOString(),
          endsAt: session.endsAt.toISOString(),
        })),
      });

      logPetEventActivity(context, ACTIVITY_EVENT.PET_EVENT_SUBMITTED, created, "Publicó el evento", {
        category: data.category,
        scope: data.scope,
        sessions: sessions.length,
        stateCode: data.stateCode,
      });

      if (isAdmin) {
        void sendZoneAlertsIfDue(context, created.id);
      } else {
        void notifyEventSubmitted(context, created, { edited: false });
      }

      return {
        success: true,
        message: isAdmin
          ? "Evento publicado."
          : "¡Listo! Tu evento está en revisión. Te avisaremos en cuanto se publique.",
        event: await eventForCaller(context, created.id),
      };
    } catch (error) {
      console.error("[submitPetEvent]", error);
      return failure("No pudimos publicar el evento. Intenta de nuevo en un momento.");
    }
  },
};

export default { typeDefs, definition, resolver };
