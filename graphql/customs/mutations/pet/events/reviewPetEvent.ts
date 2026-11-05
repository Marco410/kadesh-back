import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { PET_EVENT_LIMITS, PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { notifyEventInterested, notifyEventOwner } from "../../../../../utils/notifications/eventAlerts";
import { petSiteUrl } from "../../../../../utils/notifications/whatsapp";
import { submitPetEventToIndexNow } from "../../../../../utils/seo/indexNow";
import {
  eventForCaller,
  failure,
  logPetEventActivity,
  type PetEventMutationResult,
  prismaOf,
  sendZoneAlertsIfDue,
} from "./shared";

const typeDefs = ``;

const definition = `
  reviewPetEvent(id: ID!, approved: Boolean!, note: String): PetEventMutationResult!
`;

const resolver = {
  /**
   * Operaciones → Kadesh Pet → Eventos. Aprobar publica el evento, avisa a quien lo publicó y, si
   * su próxima fecha está a 14 días o menos, a la zona (si no, el cron avisa cuando falten 14).
   * Rechazar pide el motivo, que le llega a quien lo publicó para que lo corrija.
   */
  reviewPetEvent: async (
    _root: unknown,
    { id, approved, note }: { id: string; approved: boolean; note?: string | null },
    context: KeystoneContext,
  ): Promise<PetEventMutationResult> => {
    const adminId = getSessionUserId(context.session);
    if (!adminId || !isPlatformAdmin(context.session)) return failure("Solo un administrador puede revisar eventos.");

    try {
      const prisma = prismaOf(context);
      const event = (await prisma.petEvent.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          userId: true,
          approvedAt: true,
          lastEndsAt: true,
          pendingChangeNotice: true,
        },
      })) as {
        id: string;
        title: string;
        slug: string | null;
        status: string;
        userId: string | null;
        approvedAt: Date | null;
        lastEndsAt: Date | null;
        pendingChangeNotice: boolean;
      } | null;
      if (!event || event instanceof Error) return failure("No encontramos el evento.");
      if (event.status === PET_EVENT_STATUS.CANCELLED) return failure("El evento está cancelado.");

      const now = new Date();
      const cleanNote = (note ?? "").replace(/\s+/g, " ").trim().slice(0, PET_EVENT_LIMITS.REVIEW_NOTE_MAX);
      const sudo = context.sudo();

      if (approved) {
        if (event.status === PET_EVENT_STATUS.APPROVED) return failure("El evento ya está publicado.");
        if (event.lastEndsAt && event.lastEndsAt.getTime() < now.getTime()) {
          return failure("Ya pasaron todas sus fechas: no tiene caso publicarlo.");
        }
        await sudo.db.PetEvent.updateOne({
          where: { id },
          data: {
            status: PET_EVENT_STATUS.APPROVED,
            reviewNote: "",
            reviewedAt: now.toISOString(),
            reviewedBy: { connect: { id: adminId } },
            approvedAt: (event.approvedAt ?? now).toISOString(),
            pendingChangeNotice: false,
          },
        });
        logPetEventActivity(context, ACTIVITY_EVENT.PET_EVENT_REVIEWED, event, "Aprobó el evento", { approved: true });

        if (event.userId && event.userId !== adminId) {
          void notifyEventOwner(context, event, {
            type: NOTIFICATION_TYPE.EVENT_APPROVED,
            title: event.approvedAt ? "Publicamos los cambios de tu evento" : "Tu evento ya está publicado",
            body: event.title,
          });
        }
        if (event.pendingChangeNotice) {
          void notifyEventInterested(context, id, {
            type: NOTIFICATION_TYPE.EVENT_UPDATED,
            title: "Cambió un evento que te interesa",
            body: `${event.title}: revisa las fechas y el lugar.`,
            excludeUserId: event.userId,
          });
        }
        // Bing y las IA que se apoyan en su índice se enteran en horas (Google, por el sitemap).
        void submitPetEventToIndexNow(context, id);
        const sent = await sendZoneAlertsIfDue(context, id, now);
        return {
          success: true,
          message:
            sent === null
              ? "Evento publicado. Avisaremos a la zona cuando falten 14 días (o ya se había avisado)."
              : `Evento publicado. Avisamos a ${sent} ${sent === 1 ? "persona" : "personas"} de la zona.`,
          event: await eventForCaller(context, id),
        };
      }

      if (cleanNote.length < 5) return failure("Escribe el motivo del rechazo: le llega a quien lo publicó.");
      await sudo.db.PetEvent.updateOne({
        where: { id },
        data: {
          status: PET_EVENT_STATUS.REJECTED,
          reviewNote: cleanNote,
          reviewedAt: now.toISOString(),
          reviewedBy: { connect: { id: adminId } },
        },
      });
      logPetEventActivity(context, ACTIVITY_EVENT.PET_EVENT_REVIEWED, event, "Rechazó el evento", { approved: false });
      // Si estaba publicado, su ficha deja de ser pública: que los buscadores lo noten pronto.
      if (event.status === PET_EVENT_STATUS.APPROVED) void submitPetEventToIndexNow(context, id);
      if (event.userId && event.userId !== adminId) {
        void notifyEventOwner(context, event, {
          type: NOTIFICATION_TYPE.EVENT_REJECTED,
          title: "Tu evento necesita cambios",
          body: `${event.title}: ${cleanNote}`,
          url: petSiteUrl("/perfil?tab=events"),
        });
      }
      return { success: true, message: "Evento rechazado. Le avisamos a quien lo publicó.", event: await eventForCaller(context, id) };
    } catch (error) {
      console.error("[reviewPetEvent]", error);
      return failure("No pudimos guardar la revisión. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
