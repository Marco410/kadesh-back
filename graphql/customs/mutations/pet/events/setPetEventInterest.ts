import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_EVENT_INTEREST_KIND, PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import { getSessionUserId } from "../../../../../utils/access/tenant";
import { prismaOf } from "./shared";

const typeDefs = `
  type PetEventInterestResult {
    success: Boolean!
    message: String!
    "interested | going | null (ya no le interesa)"
    kind: String
    interestedCount: Int!
    goingCount: Int!
    isFull: Boolean!
  }
`;

const definition = `
  setPetEventInterest(eventId: ID!, kind: String): PetEventInterestResult!
`;

const KINDS = new Set<string>(Object.values(PET_EVENT_INTEREST_KIND));

async function counts(prisma: any, eventId: string, capacity: number | null) {
  const [interested, going] = await Promise.all([
    prisma.petEventInterest.count({ where: { eventId, kind: PET_EVENT_INTEREST_KIND.INTERESTED } }),
    prisma.petEventInterest.count({ where: { eventId, kind: PET_EVENT_INTEREST_KIND.GOING } }),
  ]);
  const goingCount = going instanceof Error ? 0 : Number(going);
  return {
    interestedCount: interested instanceof Error ? 0 : Number(interested),
    goingCount,
    isFull: capacity ? goingCount >= capacity : false,
  };
}

const resolver = {
  /**
   * «Me interesa» (`interested`), «Asistiré» (`going`) o quitarlo (`kind: null`). Con cupo,
   * «Asistiré» se cierra cuando ya hay tantas personas como lugares; «Me interesa» siempre se puede.
   * A quien marque cualquiera de los dos le llega el recordatorio un día antes.
   */
  setPetEventInterest: async (
    _root: unknown,
    { eventId, kind }: { eventId: string; kind?: string | null },
    context: KeystoneContext,
  ) => {
    const empty = { kind: null, interestedCount: 0, goingCount: 0, isFull: false };
    const userId = getSessionUserId(context.session);
    if (!userId) return { success: false, message: "Inicia sesión para guardar el evento.", ...empty };
    const nextKind = kind ? kind.trim() : null;
    if (nextKind && !KINDS.has(nextKind)) return { success: false, message: "Opción no válida.", ...empty };

    try {
      const prisma = prismaOf(context);
      const event = (await prisma.petEvent.findUnique({
        where: { id: eventId },
        select: { id: true, status: true, capacity: true, lastEndsAt: true },
      })) as { id: string; status: string; capacity: number | null; lastEndsAt: Date | null } | null;
      if (!event || event instanceof Error || event.status !== PET_EVENT_STATUS.APPROVED) {
        return { success: false, message: "Este evento no está disponible.", ...empty };
      }
      if (event.lastEndsAt && event.lastEndsAt.getTime() < Date.now()) {
        return { success: false, message: "Este evento ya terminó.", ...(await counts(prisma, eventId, event.capacity)), kind: null };
      }

      const key = `${userId}:${eventId}`;
      const existing = await prisma.petEventInterest.findUnique({ where: { key }, select: { id: true, kind: true } });
      if (existing instanceof Error) throw existing;

      if (!nextKind) {
        if (existing) {
          const removed = await prisma.petEventInterest.delete({ where: { key } });
          if (removed instanceof Error) throw removed;
        }
        return { success: true, message: "Listo.", kind: null, ...(await counts(prisma, eventId, event.capacity)) };
      }

      if (nextKind === PET_EVENT_INTEREST_KIND.GOING && event.capacity && existing?.kind !== PET_EVENT_INTEREST_KIND.GOING) {
        const going = await prisma.petEventInterest.count({ where: { eventId, kind: PET_EVENT_INTEREST_KIND.GOING } });
        if (going instanceof Error) throw going;
        if (Number(going) >= event.capacity) {
          return {
            success: false,
            message: "Ya no hay lugares. Puedes marcar «Me interesa» para seguir el evento.",
            kind: existing?.kind ?? null,
            ...(await counts(prisma, eventId, event.capacity)),
          };
        }
      }

      const saved = await prisma.petEventInterest.upsert({
        where: { key },
        create: { key, kind: nextKind, event: { connect: { id: eventId } }, user: { connect: { id: userId } } },
        update: { kind: nextKind },
      });
      if (saved instanceof Error) throw saved;

      return {
        success: true,
        message:
          nextKind === PET_EVENT_INTEREST_KIND.GOING
            ? "¡Te esperamos! Te recordaremos un día antes."
            : "Guardado. Te recordaremos un día antes.",
        kind: nextKind,
        ...(await counts(prisma, eventId, event.capacity)),
      };
    } catch (error) {
      console.error("[setPetEventInterest]", error);
      return { success: false, message: "No pudimos guardar tu respuesta. Intenta de nuevo.", ...empty };
    }
  },
};

export default { typeDefs, definition, resolver };
