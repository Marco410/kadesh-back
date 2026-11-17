import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { requestIp } from "../../../../utils/activity/requestMeta";
import { notifyAnimalSighted } from "../../../../utils/notifications/animalReportAlerts";
import { fillCityFromCoordinates } from "../../../../utils/pet/animalReport";
import { normalizeMxPhone } from "../../../../utils/pet/phone";
import { lastReportLog } from "../../../../utils/pet/reportLogs";
import { verifyTurnstile } from "../../../../utils/security/turnstile";
import { canEditAnimalAs } from "../../../../models/Pet/Animal/Animal.access";
import {
  SIGHTING_DEDUPE_MINUTES,
  SIGHTING_MAX_AGE_DAYS,
  SIGHTING_NAME_MAX,
  SIGHTING_NOTES_MAX,
  SIGHTING_PHONE_MAX,
  SIGHTING_PLACE_MAX,
  SIGHTING_STATUSES,
} from "../../../../models/Pet/Animal/AnimalSighting/constants";

/**
 * «Lo vi»: cualquiera, con o sin cuenta, avisa que vio a un animal perdido o abandonado. Se publica
 * al momento en la ficha (`Animal.sightings`) y se avisa a quien atiende el reporte.
 *
 * Contra abuso: límite por IP (`RATE_LIMIT_RULES`: `animal_sighting_ip*`), Turnstile si está
 * configurado, campo trampa `website` y la misma IP no repite el mismo animal en 10 minutos. Quien
 * atiende el reporte puede ocultar uno con `setAnimalSightingHidden`.
 */
const typeDefs = `
  input ReportAnimalSightingInput {
    animalId: ID!
    lat: String!
    lng: String!
    placeLabel: String
    city: String
    state: String
    "ISO. Por defecto, ahora. No puede ser futuro ni de hace más de 30 días."
    seenAt: String
    notes: String
    contactName: String
    contactPhone: String
    turnstileToken: String
    "Campo trampa: la web lo deja vacío y oculto. Si llega lleno, se finge éxito."
    website: String
  }

  type AnimalSightingResult {
    success: Boolean!
    message: String!
    sightingId: ID
  }
`;

const definition = `
  reportAnimalSighting(input: ReportAnimalSightingInput!): AnimalSightingResult!
  setAnimalSightingHidden(id: ID!, hidden: Boolean!): AnimalSightingResult!
`;

type ReportInput = {
  animalId: string;
  lat: string;
  lng: string;
  placeLabel?: string | null;
  city?: string | null;
  state?: string | null;
  seenAt?: string | null;
  notes?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  turnstileToken?: string | null;
  website?: string | null;
};

type Result = { success: boolean; message: string; sightingId: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Margen para relojes de teléfono adelantados. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function fail(message: string): Result {
  return { success: false, message, sightingId: null };
}

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanNotes(value: string | null | undefined): string {
  return (value ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, SIGHTING_NOTES_MAX);
}

function coordinate(value: string, min: number, max: number): number | null {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
}

const resolver = {
  reportAnimalSighting: async (
    _root: unknown,
    { input }: { input: ReportInput },
    context: KeystoneContext,
  ): Promise<Result> => {
    // Bot que llenó el campo oculto: no se guarda nada y no se le dice por qué.
    if (input.website?.trim()) {
      return { success: true, message: "¡Gracias! Ya le avisamos a quien lo busca.", sightingId: null };
    }

    const ip = requestIp(context.req);
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return fail("No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.");
    }

    const lat = coordinate(input.lat, -90, 90);
    const lng = coordinate(input.lng, -180, 180);
    if (lat === null || lng === null) return fail("Marca en el mapa dónde lo viste.");

    const now = Date.now();
    let seenAt = new Date(now);
    if (input.seenAt) {
      const parsed = new Date(input.seenAt);
      if (Number.isNaN(parsed.getTime())) return fail("La fecha no es válida.");
      if (parsed.getTime() > now + FUTURE_SKEW_MS) return fail("La hora no puede ser posterior a ahora.");
      if (parsed.getTime() < now - SIGHTING_MAX_AGE_DAYS * DAY_MS) {
        return fail(`Solo se pueden avisar avistamientos de los últimos ${SIGHTING_MAX_AGE_DAYS} días.`);
      }
      seenAt = parsed.getTime() > now ? new Date(now) : parsed;
    }

    let contactPhone = "";
    if (input.contactPhone?.trim()) {
      const phone = normalizeMxPhone(input.contactPhone.slice(0, SIGHTING_PHONE_MAX));
      if (!phone.ok) return fail("Revisa tu teléfono: debe tener 10 dígitos.");
      contactPhone = phone.digits;
    }

    const sudo = context.sudo();
    try {
      const animal = (await sudo.query.Animal.findOne({
        where: { id: input.animalId },
        query: "id name slug duplicateOf { id }",
      })) as { id: string; name?: string | null; slug?: string | null; duplicateOf?: { id: string } | null } | null;
      if (!animal) return fail("No encontramos este reporte.");
      const animalId = animal.duplicateOf?.id ?? animal.id;

      const last = await lastReportLog(context, animalId);
      if (!last?.status || !SIGHTING_STATUSES.includes(last.status)) {
        return fail("Este caso ya no está buscando al animal. Gracias por avisar.");
      }

      const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
      if (ip) {
        const recent = await prisma.animalSighting.count({
          where: { animalId, ip, createdAt: { gte: new Date(now - SIGHTING_DEDUPE_MINUTES * 60 * 1000) } },
        });
        if (recent instanceof Error) throw recent;
        if (recent > 0) return fail("Ya recibimos tu aviso. Si lo vuelves a ver, avísanos en unos minutos.");
      }

      // Ciudad y estado para la ficha y el aviso: los del mapa o, si no llegaron, por coordenadas.
      let city = clean(input.city, 120);
      let state = clean(input.state, 120);
      if (!city) {
        const place = await fillCityFromCoordinates({ city, state, lat: String(lat), lng: String(lng) });
        city = place.city;
        if (!state) state = place.state;
      }
      const placeLabel = clean(input.placeLabel, SIGHTING_PLACE_MAX);
      const notes = cleanNotes(input.notes);
      const userId = getSessionUserId(context.session);

      const created = (await sudo.db.AnimalSighting.createOne({
        data: {
          animal: { connect: { id: animalId } },
          ...(userId ? { user: { connect: { id: userId } } } : {}),
          seenAt: seenAt.toISOString(),
          lat: String(lat),
          lng: String(lng),
          placeLabel,
          city,
          state,
          notes,
          contactName: clean(input.contactName, SIGHTING_NAME_MAX),
          contactPhone,
          ip: ip ?? "",
        },
      })) as { id: string };

      void logActivity(context, {
        type: "animal.sighted",
        summary: `Avisó que vio a «${animal.name || animalId}»`,
        entityType: "Animal",
        entityId: animalId,
        metadata: { sightingId: created.id, city, anonymous: !userId },
      });
      void notifyAnimalSighted(context, {
        sightingId: created.id,
        animalId,
        reporterId: userId,
        seenAt,
        place: placeLabel || [city, state].filter(Boolean).join(", "),
        notes,
      });

      return { success: true, message: "¡Gracias! Ya le avisamos a quien lo busca.", sightingId: created.id };
    } catch (error) {
      console.error("[reportAnimalSighting]", error);
      return fail("No pudimos guardar tu aviso. Intenta de nuevo en un momento.");
    }
  },

  /** Quien atiende el reporte (o un admin) oculta o vuelve a mostrar un avistamiento. */
  setAnimalSightingHidden: async (
    _root: unknown,
    { id, hidden }: { id: string; hidden: boolean },
    context: KeystoneContext,
  ): Promise<Result> => {
    const userId = getSessionUserId(context.session);
    if (!userId) return fail("Inicia sesión para hacer esto.");
    const sudo = context.sudo();
    try {
      const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
      const sighting = await prisma.animalSighting.findUnique({
        where: { id },
        select: { id: true, animal: { select: { id: true, userId: true, organizationId: true } } },
      });
      if (sighting instanceof Error) throw sighting;
      if (!sighting?.animal) return fail("No encontramos ese avistamiento.");
      const allowed = isPlatformAdmin(context.session) || (await canEditAnimalAs(context, sighting.animal, userId));
      if (!allowed) return fail("Solo quien atiende el reporte puede hacer esto.");

      await sudo.db.AnimalSighting.updateOne({ where: { id }, data: { hidden } });
      return {
        success: true,
        message: hidden ? "Ocultamos el avistamiento." : "El avistamiento se ve de nuevo.",
        sightingId: id,
      };
    } catch (error) {
      console.error("[setAnimalSightingHidden]", error);
      return fail("No pudimos guardar el cambio. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
