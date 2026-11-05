import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { PET_EVENT_LIMITS, PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { notifyEventInterested } from "../../../../../utils/notifications/eventAlerts";
import { submitPetEventToIndexNow } from "../../../../../utils/seo/indexNow";
import { eventForCaller, failure, logPetEventActivity, type PetEventMutationResult, prismaOf } from "./shared";

const typeDefs = ``;

const definition = `
  cancelPetEvent(id: ID!, reason: String): PetEventMutationResult!
`;

const resolver = {
  /**
   * Cancela un evento (quien lo publicó o un admin). Si llegó a publicarse, la ficha sigue visible
   * con el aviso de cancelado y se avisa a quienes marcaron «Me interesa» o «Asistiré».
   */
  cancelPetEvent: async (
    _root: unknown,
    { id, reason }: { id: string; reason?: string | null },
    context: KeystoneContext,
  ): Promise<PetEventMutationResult> => {
    const userId = getSessionUserId(context.session);
    if (!userId) return failure("Inicia sesión para cancelar el evento.");
    const isAdmin = isPlatformAdmin(context.session);

    try {
      const prisma = prismaOf(context);
      const event = (await prisma.petEvent.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, userId: true, approvedAt: true, lastEndsAt: true },
      })) as {
        id: string;
        title: string;
        status: string;
        userId: string | null;
        approvedAt: Date | null;
        lastEndsAt: Date | null;
      } | null;
      if (!event || event instanceof Error) return failure("No encontramos el evento.");
      if (!isAdmin && event.userId !== userId) return failure("Solo quien publicó el evento puede cancelarlo.");
      if (event.status === PET_EVENT_STATUS.CANCELLED) return failure("El evento ya estaba cancelado.");

      const cleanReason = (reason ?? "").replace(/\s+/g, " ").trim().slice(0, PET_EVENT_LIMITS.CANCEL_REASON_MAX);
      await context.sudo().db.PetEvent.updateOne({
        where: { id },
        data: {
          status: PET_EVENT_STATUS.CANCELLED,
          cancelledAt: new Date().toISOString(),
          cancelReason: cleanReason,
        },
      });

      logPetEventActivity(context, ACTIVITY_EVENT.PET_EVENT_CANCELLED, event, "Canceló el evento", {
        byAdmin: isAdmin && event.userId !== userId,
      });

      // La ficha pública ahora dice «Se canceló» (y deja de indexarse).
      if (event.approvedAt) void submitPetEventToIndexNow(context, id);

      const upcoming = !event.lastEndsAt || event.lastEndsAt.getTime() > Date.now();
      if (event.approvedAt && upcoming) {
        void notifyEventInterested(context, id, {
          type: NOTIFICATION_TYPE.EVENT_CANCELLED,
          title: `Se canceló: ${event.title}`,
          body: cleanReason || "Quien lo organiza canceló el evento.",
          excludeUserId: event.userId,
        });
      }

      return { success: true, message: "Evento cancelado.", event: await eventForCaller(context, id) };
    } catch (error) {
      console.error("[cancelPetEvent]", error);
      return failure("No pudimos cancelar el evento. Intenta de nuevo en un momento.");
    }
  },
};

export default { typeDefs, definition, resolver };
