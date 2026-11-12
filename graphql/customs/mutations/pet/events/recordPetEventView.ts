import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_EVENT_STATUS, PET_EVENT_VIEW_DEDUPE_MS } from "../../../../../models/Pet/PetEvent/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { requestIp, requestUserAgent } from "../../../../../utils/activity/requestMeta";
import { isKnownCrawlerRequest } from "../../../../../utils/security/knownCrawlers";
import { createDeduper } from "../../../../../utils/security/rateLimit";
import { prismaOf } from "./shared";

const typeDefs = `
  type PetEventViewResult {
    "Si esta visita sumó. No suman quien lo publicó, los admins, los bots ni repetir en 30 min."
    counted: Boolean!
    viewsCount: Int!
  }
`;

const definition = `
  recordPetEventView(eventId: ID!): PetEventViewResult!
`;

/** En memoria del proceso: si se reinicia, alguien puede sumar una vista más. No hace falta más. */
const firstVisit = createDeduper(PET_EVENT_VIEW_DEDUPE_MS);

/** Con sesión, la persona; sin sesión, la IP y el navegador (con solo la IP, una red compartida contaría como una). */
function visitorKey(context: KeystoneContext): string {
  const userId = getSessionUserId(context.session);
  if (userId) return `u:${userId}`;
  return `ip:${requestIp(context.req) ?? "?"}|${requestUserAgent(context.req) ?? ""}`;
}

type EventRow = {
  id: string;
  status: string;
  approvedAt: Date | null;
  userId: string | null;
  viewsCount: number | null;
};

/** Solo la ficha pública suma: publicado, o cancelado después de publicarse (sigue visible). */
function isPublic(event: EventRow): boolean {
  if (event.status === PET_EVENT_STATUS.APPROVED) return true;
  return event.status === PET_EVENT_STATUS.CANCELLED && Boolean(event.approvedAt);
}

const resolver = {
  /**
   * La web la llama una vez al abrir la ficha y muestra el total que devuelve. Nunca falla hacia
   * afuera: si algo sale mal responde `counted: false` y la ficha se queda con el número que tenía.
   */
  recordPetEventView: async (_root: unknown, { eventId }: { eventId: string }, context: KeystoneContext) => {
    try {
      const prisma = prismaOf(context);
      const event = (await prisma.petEvent.findUnique({
        where: { id: eventId },
        select: { id: true, status: true, approvedAt: true, userId: true, viewsCount: true },
      })) as EventRow | null;
      if (!event || event instanceof Error || !isPublic(event)) return { counted: false, viewsCount: 0 };

      const current = { counted: false, viewsCount: event.viewsCount ?? 0 };
      const userId = getSessionUserId(context.session);
      if (userId && userId === event.userId) return current;
      if (isPlatformAdmin(context.session as any)) return current;
      if (isKnownCrawlerRequest(context.req)) return current;
      if (!firstVisit(`${eventId}:${visitorKey(context)}`)) return current;

      const rows = (await prisma.$queryRaw`
        UPDATE "PetEvent" SET "viewsCount" = "viewsCount" + 1
        WHERE "id" = ${eventId}
        RETURNING "viewsCount"
      `) as Array<{ viewsCount: number }>;
      return { counted: true, viewsCount: Number(rows[0]?.viewsCount ?? current.viewsCount + 1) };
    } catch (error) {
      console.error("[recordPetEventView]", error);
      return { counted: false, viewsCount: 0 };
    }
  },
};

export default { typeDefs, definition, resolver };
