import { graphql, list } from "@keystone-6/core";
import {
  checkbox,
  float,
  integer,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../utils/access/tenant";
import { cityKey, normalizeStateCode, stateByCode, timeZoneForState } from "../../../utils/geo/mexicoStates";
import { petEventAccess } from "./PetEvent.access";
import { buildPetEventSlug, uniquePetEventSlug } from "./PetEvent.rules";
import {
  DEFAULT_PET_EVENT_REACH_KM,
  PET_EVENT_CATEGORY_OPTIONS,
  PET_EVENT_INTEREST_KIND,
  PET_EVENT_SCOPE,
  PET_EVENT_SCOPE_OPTIONS,
  PET_EVENT_SPECIES_OPTIONS,
  PET_EVENT_STATUS,
  PET_EVENT_STATUS_OPTIONS,
} from "./constants";

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

async function countInterests(context: KeystoneContext, eventId: string, kind: string): Promise<number> {
  const count = await prismaOf(context).petEventInterest.count({ where: { eventId, kind } });
  return count instanceof Error ? 0 : Number(count);
}

/** Próxima fecha que no ha terminado (o null si ya pasaron todas). */
async function nextSession(context: KeystoneContext, eventId: string) {
  const row = await prismaOf(context).petEventSession.findFirst({
    where: { eventId, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, endsAt: true },
  });
  return row instanceof Error ? null : (row as { startsAt: Date; endsAt: Date } | null);
}

/**
 * Evento de Kadesh Pet (campaña de esterilización, vacunación, feria de adopción…). La escritura
 * pasa por las mutaciones de `graphql/customs/mutations/pet/events/`. Ver README.md.
 */
export default list({
  access: petEventAccess,
  ui: {
    labelField: "title",
    listView: {
      initialColumns: ["title", "status", "category", "city", "state", "firstStartsAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  hooks: {
    // Los cambios hechos desde el admin de Keystone también dejan listos slug, estado y zona horaria.
    resolveInput: async ({ resolvedData, item, operation, context }: any) => {
      const data = { ...resolvedData };
      // `resolvedData` trae todas las llaves; las que no vienen en el cambio valen `undefined`.
      const stateChanged = data.state !== undefined;
      const cityChanged = data.city !== undefined;
      if (stateChanged || cityChanged) {
        const stateCode = normalizeStateCode(data.state ?? item?.state) ?? item?.stateCode ?? null;
        if (stateCode) {
          data.stateCode = stateCode;
          data.timeZone = timeZoneForState(stateCode);
          if (stateChanged) data.state = stateByCode(stateCode)?.name ?? data.state;
        }
        if (cityChanged) data.cityKey = cityKey(data.city);
      }
      if (operation === "create" && !data.slug) {
        data.slug = await uniquePetEventSlug(context, buildPetEventSlug(data.title ?? "evento", data.city));
      }
      return data;
    },
  },
  fields: {
    title: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: "unique", db: { isNullable: true } }),
    category: select({
      type: "string",
      options: PET_EVENT_CATEGORY_OPTIONS.map(({ label, value }) => ({ label, value })),
      validation: { isRequired: true },
      isIndexed: true,
    }),
    species: multiselect({
      type: "string",
      options: PET_EVENT_SPECIES_OPTIONS,
      defaultValue: [],
      ui: { description: "Para qué animales es (vacío = cualquiera)" },
    }),
    description: text({ ui: { displayMode: "textarea" } }),
    requirements: text({
      ui: { displayMode: "textarea", description: "Requisitos: ayuno, edad mínima, llevar correa…" },
    }),
    organizerName: text({ ui: { description: "Quién organiza (asociación, veterinaria, municipio…)" } }),
    contactPhone: text({ ui: { description: "10 dígitos" } }),
    petPlace: relationship({
      ref: "PetPlace",
      ui: { description: "Veterinaria verificada que organiza (opcional)" },
    }),
    user: relationship({ ref: "User", ui: { description: "Quien lo publicó" } }),

    // Ubicación (llenada desde el pin; municipio y estado con Nominatim si faltan)
    lat: float({ validation: { isRequired: true, min: -90, max: 90 } }),
    lng: float({ validation: { isRequired: true, min: -180, max: 180 } }),
    placeLabel: text({ ui: { description: "Nombre del lugar: «Explanada del Jardín Morelos»" } }),
    address: text(),
    neighborhood: text(),
    city: text(),
    cityKey: text({ isIndexed: true, db: { isNullable: true }, ui: { itemView: { fieldMode: "read" } } }),
    state: text(),
    stateCode: text({
      isIndexed: true,
      db: { isNullable: true },
      ui: { description: "Clave INEGI del estado (01–32)", itemView: { fieldMode: "read" } },
    }),
    timeZone: text({ defaultValue: "America/Mexico_City", ui: { itemView: { fieldMode: "read" } } }),

    // Alcance
    scope: select({
      type: "string",
      options: PET_EVENT_SCOPE_OPTIONS,
      defaultValue: PET_EVENT_SCOPE.ZONE,
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    reachKm: integer({
      defaultValue: DEFAULT_PET_EVENT_REACH_KM,
      validation: { min: 1, max: 100 },
      ui: { description: "Solo con alcance «Zona»: radio en km alrededor del punto" },
    }),

    // Costo, cupo y registro
    isFree: checkbox({ defaultValue: true }),
    price: integer({ db: { isNullable: true }, validation: { min: 0 }, ui: { description: "Pesos MXN" } }),
    priceNote: text({ ui: { description: "«Cuota de recuperación», «Donativo voluntario»…" } }),
    capacity: integer({ db: { isNullable: true }, validation: { min: 1 }, ui: { description: "Lugares (vacío = sin cupo)" } }),
    registrationUrl: text(),
    registrationWhatsapp: text({ ui: { description: "10 dígitos" } }),

    // Redes del evento o de quien lo organiza (links completos; ver normalizeSocialUrl)
    facebookUrl: text({ ui: { description: "Página o evento de Facebook" } }),
    instagramUrl: text({ ui: { description: "Perfil de Instagram" } }),
    tiktokUrl: text({ ui: { description: "Perfil de TikTok" } }),
    xUrl: text({ ui: { description: "Perfil de X (Twitter)" } }),
    websiteUrl: text({ ui: { description: "Sitio web" } }),

    // Fechas (las recalculan los hooks de PetEventSession)
    sessions: relationship({ ref: "PetEventSession.event", many: true }),
    firstStartsAt: timestamp({ db: { isNullable: true }, isIndexed: true, ui: { itemView: { fieldMode: "read" } } }),
    lastEndsAt: timestamp({ db: { isNullable: true }, isIndexed: true, ui: { itemView: { fieldMode: "read" } } }),

    multimedia: relationship({ ref: "PetEventMultimedia.event", many: true }),
    interests: relationship({ ref: "PetEventInterest.event", many: true }),

    // Revisión
    status: select({
      type: "string",
      options: PET_EVENT_STATUS_OPTIONS,
      defaultValue: PET_EVENT_STATUS.PENDING,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { displayMode: "segmented-control" },
    }),
    reviewNote: text({ ui: { description: "Motivo del rechazo (lo ve quien lo publicó)" } }),
    reviewedAt: timestamp({ db: { isNullable: true } }),
    reviewedBy: relationship({ ref: "User" }),
    approvedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Primera vez que se publicó. Un cancelado con fecha sigue visible." },
    }),
    pendingChangeNotice: checkbox({
      defaultValue: false,
      ui: { description: "Cambió fechas o lugar: al aprobar se avisa a quienes les interesa" },
    }),
    zoneAlertsSentAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Cuándo se avisó a la zona (una sola vez)" },
    }),
    zoneAlertsCount: integer({ defaultValue: 0, ui: { description: "A cuántas personas se avisó" } }),
    cancelledAt: timestamp({ db: { isNullable: true } }),
    cancelReason: text(),
    // Lo suma `recordPetEventView` con SQL directo: un update de Prisma movería `updatedAt` en cada vista.
    viewsCount: integer({
      defaultValue: 0,
      db: { isNullable: false },
      ui: {
        description: "Vistas de la ficha publicada. No cuentan quien lo publicó, los admins ni los bots",
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),

    // Calculados
    nextStartsAt: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args: unknown, context: KeystoneContext) {
          const session = await nextSession(context, item.id);
          return session ? session.startsAt.toISOString() : null;
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    nextEndsAt: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args: unknown, context: KeystoneContext) {
          const session = await nextSession(context, item.id);
          return session ? session.endsAt.toISOString() : null;
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    interestedCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve: (item: any, _args: unknown, context: KeystoneContext) =>
          countInterests(context, item.id, PET_EVENT_INTEREST_KIND.INTERESTED),
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    goingCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve: (item: any, _args: unknown, context: KeystoneContext) =>
          countInterests(context, item.id, PET_EVENT_INTEREST_KIND.GOING),
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    isFull: virtual({
      field: graphql.field({
        type: graphql.Boolean,
        async resolve(item: any, _args: unknown, context: KeystoneContext) {
          if (!item.capacity) return false;
          return (await countInterests(context, item.id, PET_EVENT_INTEREST_KIND.GOING)) >= item.capacity;
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    /** "interested", "going" o null para la persona de la sesión. */
    myInterest: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args: unknown, context: KeystoneContext) {
          const userId = getSessionUserId(context.session);
          if (!userId) return null;
          const row = await prismaOf(context).petEventInterest.findFirst({
            where: { eventId: item.id, userId },
            select: { kind: true },
          });
          return row instanceof Error ? null : (row?.kind ?? null);
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),

    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
});
