import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import {
  diffSessions,
  normalizePetEventInput,
  type PetEventInput,
  placeChanged,
} from "../../../../../models/Pet/PetEvent/PetEvent.rules";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { notifyEventInterested, notifyEventSubmitted } from "../../../../../utils/notifications/eventAlerts";
import { submitPetEventToIndexNow } from "../../../../../utils/seo/indexNow";
import { eventForCaller, failure, logPetEventActivity, type PetEventMutationResult, prismaOf } from "./shared";

const typeDefs = ``;

const definition = `
  updateMyPetEvent(id: ID!, input: PetEventInput!): PetEventMutationResult!
`;

type EventRow = {
  id: string;
  title: string;
  slug: string | null;
  city: string;
  state: string;
  status: string;
  userId: string | null;
  petPlaceId: string | null;
  lat: number;
  lng: number;
  address: string;
  placeLabel: string;
  approvedAt: Date | null;
  lastEndsAt: Date | null;
  pendingChangeNotice: boolean;
};

const resolver = {
  /**
   * Edita un evento propio (el formulario completo, con todas sus fechas). Si quien edita no es
   * admin y el evento estaba publicado o rechazado, vuelve a «En revisión». Si cambiaron las fechas
   * o el lugar de uno publicado, al aprobarlo de nuevo se avisa a quienes les interesa.
   */
  updateMyPetEvent: async (
    _root: unknown,
    { id, input }: { id: string; input: PetEventInput },
    context: KeystoneContext,
  ): Promise<PetEventMutationResult> => {
    const userId = getSessionUserId(context.session);
    if (!userId) return failure("Inicia sesión para editar el evento.");
    const isAdmin = isPlatformAdmin(context.session);

    try {
      const prisma = prismaOf(context);
      const event = (await prisma.petEvent.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          slug: true,
          city: true,
          state: true,
          status: true,
          userId: true,
          petPlaceId: true,
          lat: true,
          lng: true,
          address: true,
          placeLabel: true,
          approvedAt: true,
          lastEndsAt: true,
          pendingChangeNotice: true,
        },
      })) as EventRow | null;
      if (!event || event instanceof Error) return failure("No encontramos el evento.");
      if (!isAdmin && event.userId !== userId) return failure("Solo quien publicó el evento puede editarlo.");
      if (event.status === PET_EVENT_STATUS.CANCELLED) return failure("El evento está cancelado: ya no se puede editar.");
      const now = new Date();
      if (!isAdmin && event.lastEndsAt && event.lastEndsAt.getTime() < now.getTime()) {
        return failure("Este evento ya terminó.");
      }

      const current = (await prisma.petEventSession.findMany({
        where: { eventId: id },
        select: { id: true, startsAt: true, endsAt: true },
      })) as Array<{ id: string; startsAt: Date; endsAt: Date }>;

      const normalized = await normalizePetEventInput(context, input, {
        isAdmin,
        userId: event.userId,
        existingSessions: current,
        now,
      });
      if (!normalized.ok) return failure(normalized.message);
      const { data, sessions } = normalized.value;

      const diff = diffSessions(current, sessions);
      const datesOrPlaceChanged =
        diff.deleteIds.length > 0 || diff.create.length > 0 || placeChanged(event, data);
      const wasPublished = event.status === PET_EVENT_STATUS.APPROVED;
      const backToReview =
        !isAdmin && (event.status === PET_EVENT_STATUS.APPROVED || event.status === PET_EVENT_STATUS.REJECTED);
      const nextStatus = backToReview ? PET_EVENT_STATUS.PENDING : event.status;

      const sudo = context.sudo();
      await sudo.db.PetEvent.updateOne({
        where: { id },
        data: {
          ...data,
          ...(!input.petPlaceId && event.petPlaceId ? { petPlace: { disconnect: true } } : {}),
          status: nextStatus,
          // Los interesados se enteran del cambio cuando se publique otra vez (reviewPetEvent).
          pendingChangeNotice: backToReview && wasPublished && datesOrPlaceChanged ? true : event.pendingChangeNotice,
        },
      });
      if (diff.deleteIds.length > 0) {
        await sudo.db.PetEventSession.deleteMany({ where: diff.deleteIds.map((sessionId) => ({ id: sessionId })) });
      }
      if (diff.create.length > 0) {
        await sudo.db.PetEventSession.createMany({
          data: diff.create.map((session) => ({
            event: { connect: { id } },
            startsAt: session.startsAt.toISOString(),
            endsAt: session.endsAt.toISOString(),
          })),
        });
      }

      logPetEventActivity(context, ACTIVITY_EVENT.PET_EVENT_UPDATED, { id, title: String(data.title) }, "Editó el evento", {
        datesOrPlaceChanged,
        backToReview,
      });

      if (!isAdmin) {
        if (nextStatus === PET_EVENT_STATUS.PENDING) {
          void notifyEventSubmitted(
            context,
            { id, slug: event.slug, title: String(data.title), city: String(data.city ?? ""), state: String(data.state ?? "") },
            { edited: true },
          );
        }
      } else if (wasPublished) {
        // Un admin editó uno publicado: sigue público con los cambios.
        void submitPetEventToIndexNow(context, id);
      }
      if (isAdmin && wasPublished && datesOrPlaceChanged) {
        void notifyEventInterested(context, id, {
          type: NOTIFICATION_TYPE.EVENT_UPDATED,
          title: `Cambió un evento que te interesa`,
          body: `${String(data.title)}: revisa las fechas y el lugar.`,
        });
      }

      const message = backToReview
        ? wasPublished
          ? "Guardamos los cambios. El evento vuelve a revisión y se publicará otra vez al aprobarse."
          : "Guardamos los cambios y lo mandamos a revisión."
        : "Guardamos los cambios.";
      return { success: true, message, event: await eventForCaller(context, id) };
    } catch (error) {
      console.error("[updateMyPetEvent]", error);
      return failure("No pudimos guardar los cambios. Intenta de nuevo en un momento.");
    }
  },
};

export default { typeDefs, definition, resolver };
