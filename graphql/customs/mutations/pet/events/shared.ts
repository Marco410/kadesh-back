import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_EVENT_STATUS } from "../../../../../models/Pet/PetEvent/constants";
import { logActivity } from "../../../../../utils/activity/logActivity";
import {
  isWithinAlertLead,
  loadPetEventForNotice,
  notifyEventInZone,
} from "../../../../../utils/notifications/eventAlerts";

/** Tipos compartidos por las mutaciones de eventos (van una sola vez en index.ts). */
export const petEventSharedTypeDefs = `
  input PetEventSessionInput {
    "ISO 8601 en UTC"
    startsAt: String!
    endsAt: String!
  }

  input PetEventInput {
    title: String!
    "esterilizacion | vacunacion | adopcion | desparasitacion | consulta | colecta | voluntariado | taller | otro"
    category: String!
    "dog | cat | other"
    species: [String!]
    description: String!
    requirements: String
    organizerName: String
    contactPhone: String
    "Veterinaria verificada de la persona (opcional)"
    petPlaceId: ID
    lat: Float!
    lng: Float!
    placeLabel: String
    address: String
    neighborhood: String
    city: String
    state: String
    "zone | city | state | national (national solo admins)"
    scope: String!
    "Solo con scope zone: 5, 10, 20 o 50"
    reachKm: Int
    isFree: Boolean!
    "Pesos MXN"
    price: Int
    priceNote: String
    capacity: Int
    registrationUrl: String
    registrationWhatsapp: String
    "Link o usuario (@refugio); se guarda como link"
    facebookUrl: String
    instagramUrl: String
    tiktokUrl: String
    xUrl: String
    websiteUrl: String
    sessions: [PetEventSessionInput!]!
  }

  type PetEventMutationResult {
    success: Boolean!
    message: String!
    event: PetEvent
  }
`;

export type PetEventMutationResult = {
  success: boolean;
  message: string;
  event: unknown;
};

export function failure(message: string): PetEventMutationResult {
  return { success: false, message, event: null };
}

export function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

/** El evento como lo ve quien llama (para devolverlo en el resultado). */
export async function eventForCaller(context: KeystoneContext, id: string): Promise<unknown> {
  try {
    return await context.db.PetEvent.findOne({ where: { id } });
  } catch {
    return null;
  }
}

/** Actividad de un evento (fire-and-forget). Nunca guarda la descripción ni datos de contacto. */
export function logPetEventActivity(
  context: KeystoneContext,
  type: string,
  event: { id: string; title?: string | null },
  verb: string,
  metadata?: Record<string, unknown>,
): void {
  const title = event.title?.trim() ? `"${event.title.trim().slice(0, 80)}"` : "un evento";
  void logActivity(context, {
    type,
    summary: `${verb} ${title}`,
    entityType: "PetEvent",
    entityId: event.id,
    metadata: metadata ?? null,
  });
}

/**
 * Avisa a la zona si el evento está aprobado, no se ha avisado y su próxima fecha está a 14 días
 * o menos. Aparta el evento antes de avisar (`zoneAlertsSentAt`) para que dos llamadas cruzadas
 * no avisen dos veces. Devuelve a cuántas personas se avisó, o `null` si no tocaba.
 */
export async function sendZoneAlertsIfDue(context: KeystoneContext, eventId: string, now = new Date()): Promise<number | null> {
  try {
    const event = await loadPetEventForNotice(context, eventId, now);
    if (!event || event.status !== PET_EVENT_STATUS.APPROVED || event.zoneAlertsSentAt || !event.next) return null;
    if (!isWithinAlertLead(event.next.startsAt, now)) return null;
    const prisma = prismaOf(context);
    const claimed = await prisma.petEvent.updateMany({
      where: { id: eventId, zoneAlertsSentAt: null, status: PET_EVENT_STATUS.APPROVED },
      data: { zoneAlertsSentAt: now },
    });
    if (claimed instanceof Error) throw claimed;
    if (claimed.count !== 1) return null;
    const sent = await notifyEventInZone(context, eventId);
    const updated = await prisma.petEvent.update({ where: { id: eventId }, data: { zoneAlertsCount: sent } });
    if (updated instanceof Error) throw updated;
    return sent;
  } catch (error) {
    console.error("[pet-event] No se pudo avisar a la zona:", eventId, error);
    return null;
  }
}
