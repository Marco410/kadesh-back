import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_EVENT_ALERTS, PET_EVENT_SCOPE, PET_EVENT_STATUS } from "../../../models/Pet/PetEvent/constants";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { MEXICO_STATES, normalizeStateCode, stateBySlug } from "../../../utils/geo/mexicoStates";
import {
  findEventAlertCandidates,
  isWithinAlertLead,
  loadPetEventForNotice,
  pickEventAlertRecipients,
} from "../../../utils/notifications/eventAlerts";

const MAX_TAKE = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Sin filtro de fechas: un rango que lo cubre todo (evita parámetros nulos sin tipo en SQL). */
const MIN_DATE = new Date("1970-01-01T00:00:00.000Z");
const MAX_DATE = new Date("9999-12-31T00:00:00.000Z");

const typeDefs = `
  input PetEventsFeedInput {
    "Clave INEGI (16) o slug (michoacan)"
    state: String
    "Municipio como llave: morelia, san-luis-potosi"
    city: String
    category: String
    "ISO 8601: la próxima fecha empieza antes de esto (esta semana, este mes)"
    to: String
    lat: Float
    lng: Float
    "Con lat/lng: solo eventos a esta distancia en km (los nacionales siempre salen)"
    radiusKm: Float
    "date (por defecto) | distance"
    sort: String
    "true = eventos que ya terminaron, del más reciente al más viejo"
    past: Boolean
    take: Int = 12
    skip: Int = 0
  }

  type PetEventsFeedItem {
    event: PetEvent!
    "Próxima fecha (o la última, con past)"
    nextStartsAt: String
    nextEndsAt: String
    "Con lat/lng"
    distanceKm: Float
  }

  type PetEventsFeedResult {
    total: Int!
    items: [PetEventsFeedItem!]!
  }

  type PetEventCityFacet {
    key: String!
    name: String!
    count: Int!
  }

  type PetEventStateFacet {
    code: String!
    slug: String!
    name: String!
    count: Int!
    cities: [PetEventCityFacet!]!
  }

  type PetEventAlertPreview {
    "Personas a las que se avisaría (ya sin quienes llegaron al tope del día o ya recibieron este evento)"
    recipients: Int!
    "Personas a las que les toca el evento, sin topes"
    candidates: Int!
    alreadySent: Boolean!
    "true = se avisa al aprobar; false = lo manda el cron cuando falten 14 días"
    sendNow: Boolean!
    "ISO 8601: cuándo avisará el cron si no es ahora"
    sendAt: String
  }
`;

const definition = `
  petEventsFeed(input: PetEventsFeedInput!): PetEventsFeedResult!
  petEventFacets: [PetEventStateFacet!]!
  adminPetEventAlertPreview(id: ID!): PetEventAlertPreview
`;

type FeedInput = {
  state?: string | null;
  city?: string | null;
  category?: string | null;
  to?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  sort?: string | null;
  past?: boolean | null;
  take?: number | null;
  skip?: number | null;
};

type FeedRow = { id: string; nextStartsAt: Date | null; nextEndsAt: Date | null; km: number | null; total: number };

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function validDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

const resolver = {
  /**
   * Eventos publicados para la sección /eventos, la portada y la app: los próximos (por su próxima
   * fecha) o los pasados. Filtros por estado, municipio, tipo, fecha y distancia.
   */
  petEventsFeed: async (_root: unknown, { input }: { input: FeedInput }, context: KeystoneContext) => {
    const prisma = prismaOf(context);
    const now = new Date();
    const take = Math.min(Math.max(Number(input.take) || 12, 1), MAX_TAKE);
    const skip = Math.max(Number(input.skip) || 0, 0);
    const stateText = (input.state ?? "").trim();
    const stateCode = stateBySlug(stateText)?.code ?? normalizeStateCode(stateText) ?? (stateText ? "--" : "");
    const city = (input.city ?? "").trim().toLowerCase();
    const category = (input.category ?? "").trim();
    const to = validDate(input.to, MAX_DATE);
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && input.lat !== null && input.lng !== null;
    const radiusKm = hasPoint && Number(input.radiusKm) > 0 ? Number(input.radiusKm) : 0;
    const byDistance = hasPoint && input.sort === "distance";
    const pointLat = hasPoint ? lat : 0;
    const pointLng = hasPoint ? lng : 0;

    const rows = input.past
      ? await prisma.$queryRaw`
          SELECT e.id, ls."startsAt" AS "nextStartsAt", ls."endsAt" AS "nextEndsAt", d.km, COUNT(*) OVER()::int AS total
          FROM "PetEvent" e
          JOIN LATERAL (
            SELECT s."startsAt", s."endsAt" FROM "PetEventSession" s
            WHERE s.event = e.id ORDER BY s."startsAt" DESC LIMIT 1
          ) ls ON true
          CROSS JOIN LATERAL (
            SELECT CASE WHEN ${hasPoint} THEN 6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(${pointLat}::float8)) * cos(radians(e.lat)) * cos(radians(e.lng) - radians(${pointLng}::float8))
              + sin(radians(${pointLat}::float8)) * sin(radians(e.lat))
            ))) END AS km
          ) d
          WHERE e.status = ${PET_EVENT_STATUS.APPROVED}
            AND e."lastEndsAt" < ${now}
            AND (${stateCode} = '' OR e."stateCode" = ${stateCode})
            AND (${city} = '' OR e."cityKey" = ${city})
            AND (${category} = '' OR e.category = ${category})
            AND (${radiusKm}::float8 = 0 OR e.scope = ${PET_EVENT_SCOPE.NATIONAL} OR d.km <= ${radiusKm}::float8)
          ORDER BY ls."startsAt" DESC, e.id
          LIMIT ${take}::int OFFSET ${skip}::int
        `
      : await prisma.$queryRaw`
          SELECT e.id, ns."startsAt" AS "nextStartsAt", ns."endsAt" AS "nextEndsAt", d.km, COUNT(*) OVER()::int AS total
          FROM "PetEvent" e
          JOIN LATERAL (
            SELECT s."startsAt", s."endsAt" FROM "PetEventSession" s
            WHERE s.event = e.id AND s."endsAt" >= ${now}
            ORDER BY s."startsAt" ASC LIMIT 1
          ) ns ON true
          CROSS JOIN LATERAL (
            SELECT CASE WHEN ${hasPoint} THEN 6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(${pointLat}::float8)) * cos(radians(e.lat)) * cos(radians(e.lng) - radians(${pointLng}::float8))
              + sin(radians(${pointLat}::float8)) * sin(radians(e.lat))
            ))) END AS km
          ) d
          WHERE e.status = ${PET_EVENT_STATUS.APPROVED}
            AND ns."startsAt" < ${to}
            AND (${stateCode} = '' OR e."stateCode" = ${stateCode})
            AND (${city} = '' OR e."cityKey" = ${city})
            AND (${category} = '' OR e.category = ${category})
            AND (${radiusKm}::float8 = 0 OR e.scope = ${PET_EVENT_SCOPE.NATIONAL} OR d.km <= ${radiusKm}::float8)
          ORDER BY CASE WHEN ${byDistance} THEN d.km END ASC NULLS LAST, ns."startsAt" ASC, e.id
          LIMIT ${take}::int OFFSET ${skip}::int
        `;
    if (rows instanceof Error) throw rows;
    const list = rows as FeedRow[];
    if (list.length === 0) return { total: 0, items: [] };

    // Con el contexto de quien pide: Keystone resuelve los campos (fotos, conteos) con su acceso.
    const events = (await context.db.PetEvent.findMany({ where: { id: { in: list.map((row) => row.id) } } })) as Array<{
      id: string;
    }>;
    const byId = new Map(events.map((event) => [event.id, event]));
    const items = list
      .filter((row) => byId.has(row.id))
      .map((row) => ({
        event: byId.get(row.id),
        nextStartsAt: row.nextStartsAt ? new Date(row.nextStartsAt).toISOString() : null,
        nextEndsAt: row.nextEndsAt ? new Date(row.nextEndsAt).toISOString() : null,
        distanceKm: row.km === null || row.km === undefined ? null : Math.round(Number(row.km) * 10) / 10,
      }));
    return { total: Number(list[0].total) || items.length, items };
  },

  /** Estados y municipios con eventos próximos publicados (para los filtros de /eventos). */
  petEventFacets: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    const prisma = prismaOf(context);
    const rows = await prisma.$queryRaw`
      SELECT e."stateCode" AS "stateCode", e."cityKey" AS "cityKey", MIN(e.city) AS city, COUNT(*)::int AS count
      FROM "PetEvent" e
      WHERE e.status = ${PET_EVENT_STATUS.APPROVED}
        AND e."lastEndsAt" >= ${new Date()}
        AND e."stateCode" IS NOT NULL
      GROUP BY e."stateCode", e."cityKey"
    `;
    if (rows instanceof Error) throw rows;
    const byState = new Map<string, { count: number; cities: Array<{ key: string; name: string; count: number }> }>();
    for (const row of rows as Array<{ stateCode: string; cityKey: string | null; city: string | null; count: number }>) {
      const entry = byState.get(row.stateCode) ?? { count: 0, cities: [] };
      entry.count += Number(row.count);
      if (row.cityKey) entry.cities.push({ key: row.cityKey, name: row.city || row.cityKey, count: Number(row.count) });
      byState.set(row.stateCode, entry);
    }
    return MEXICO_STATES.filter((state) => byState.has(state.code)).map((state) => {
      const entry = byState.get(state.code)!;
      return {
        code: state.code,
        slug: state.slug,
        name: state.name,
        count: entry.count,
        cities: entry.cities.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")),
      };
    });
  },

  /** Operaciones: a cuántas personas avisaría el evento y cuándo. */
  adminPetEventAlertPreview: async (_root: unknown, { id }: { id: string }, context: KeystoneContext) => {
    if (!isPlatformAdmin(context.session)) return null;
    const event = await loadPetEventForNotice(context, id);
    if (!event) return null;
    const candidates = await findEventAlertCandidates(context, event);
    const sendNow = Boolean(event.next && isWithinAlertLead(event.next.startsAt));
    return {
      recipients: pickEventAlertRecipients(candidates).length,
      candidates: candidates.length,
      alreadySent: Boolean(event.zoneAlertsSentAt),
      sendNow,
      sendAt:
        !sendNow && event.next
          ? new Date(event.next.startsAt.getTime() - PET_EVENT_ALERTS.LEAD_DAYS * DAY_MS).toISOString()
          : null,
    };
  },
};

export default { typeDefs, definition, resolver };
