import { KeystoneContext } from "@keystone-6/core/types";
import {
  LEAD_SOURCE,
  PIPELINE_STATUS,
} from "../../../../models/Tech/crm/constants";
import { haversineDistance } from "../../../../utils/helpers/calculate_distances";
import { getRemainingCredits } from "../../../../utils/helpers/tech/remaining_credits";
import { consumeCompanyCredits } from "../../../../utils/saas/companyCredits";
import {
  denueContains,
  denueKeywordVariants,
  resolveDenueSearch,
} from "../../../../utils/constants/inegiDenueCategories";
import {
  DENUE_MAX_RADIUS_METERS,
  formatEstablishmentAddress,
  mapDenueApiRow,
  searchByLocation,
  upsertEstablishment,
} from "../../../../utils/inegi";

/**
 * Espejo de syncLeadsFront para DENUE: lat/lng/radio → leads en la company.
 * Misma bolsa de créditos, connect N:M, status Detectado.
 * Radio de catálogo/Haversine = el que manda el cliente (km).
 * API DENUE en vivo: máx. 5000 m.
 */
const DEFAULT_MAX_RESULTS = 60;
const CATALOG_TAKE = 1000;

const MSG = {
  login: "Inicia sesión para buscar negocios.",
  noCompany: "Tu cuenta no tiene una empresa asignada.",
  noSubscription:
    "No hay una suscripción activa. Contrata o activa una para buscar negocios.",
  freeExpired:
    "Tu plan gratuito terminó. Contrata una suscripción para seguir buscando clientes.",
  noLeadLimit:
    "Tu suscripción no permite buscar negocios por ahora. Contacta a soporte.",
  leadLimitTooLow: "Tu suscripción no permite buscar negocios por ahora.",
  quotaFull: (synced: number | null, limit: number | null) =>
    limit != null && synced != null
      ? `Ya usaste tu cuota de este mes (${synced}/${limit}). Se reinicia el próximo mes.`
      : "Ya usaste tu cuota de este mes. Se reinicia el próximo mes.",
  searchFailed:
    "No pudimos completar la búsqueda. Intenta de nuevo en unos minutos.",
  noneFound:
    "No encontramos negocios cerca con esa búsqueda. Prueba otra categoría o un radio más amplio.",
  added: (count: number) =>
    count === 1
      ? "Agregamos 1 negocio a tu lista."
      : `Agregamos ${count} negocios a tu lista.`,
};

const ESTABLISHMENT_QUERY = `
  id
  clee
  name
  legalName
  phone
  email
  website
  street
  exteriorNumber
  neighborhood
  postalCode
  locality
  municipality
  state
  lat
  lng
  economicActivity { id name scianCode }
`;

type EstablishmentRow = {
  id: string;
  clee: string;
  name: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  street?: string | null;
  exteriorNumber?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  locality?: string | null;
  municipality?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  economicActivity?: { id: string; name?: string | null } | null;
};

type SyncResult = {
  success: boolean;
  message: string;
  created: number;
  alreadyInDb: number;
  skippedLowRating: number;
  syncedLeadsCount: number;
  syncedCount: number | null;
  leadLimit: number | null;
};

const typeDefs = `
  input SyncLeadsFromInegiInput {
    lat: Float!
    lng: Float!
    radius: Float!
    category: String!
    maxResults: Int
  }

  type SyncLeadsFromInegiResult {
    success: Boolean!
    message: String!
    created: Int!
    alreadyInDb: Int!
    skippedLowRating: Int!
    syncedLeadsCount: Int!
    syncedCount: Int
    leadLimit: Int
  }

  type Mutation {
    syncLeadsFromInegi(input: SyncLeadsFromInegiInput!): SyncLeadsFromInegiResult!
  }
`;

const definition = `
  syncLeadsFromInegi(input: SyncLeadsFromInegiInput!): SyncLeadsFromInegiResult!
`;

function emptyFields(): Omit<SyncResult, "success" | "message"> {
  return {
    created: 0,
    alreadyInDb: 0,
    skippedLowRating: 0,
    syncedLeadsCount: 0,
    syncedCount: null,
    leadLimit: null,
  };
}

function inRadius(
  centerLat: number,
  centerLng: number,
  lat: number | null | undefined,
  lng: number | null | undefined,
  radiusKm: number,
): boolean {
  if (lat == null || lng == null) return false;
  return haversineDistance(centerLat, centerLng, lat, lng) <= radiusKm;
}

/** Caja aproximada (~111 km/grado) para no barrer el catálogo nacional. */
function boundingBoxFilters(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [
    { lat: { gte: lat - latDelta, lte: lat + latDelta } },
    { lng: { gte: lng - lngDelta, lte: lng + lngDelta } },
  ];
}

async function ensureStatus(
  context: KeystoneContext,
  leadId: string,
  companyId: string,
  userId: string,
) {
  const [existing] = await context
    .sudo()
    .query.TechStatusBusinessLead.findMany({
      where: {
        businessLead: { id: { equals: leadId } },
        saasCompany: { id: { equals: companyId } },
      },
      take: 1,
      query: "id",
    });
  if (existing) {
    await context.sudo().query.TechStatusBusinessLead.updateOne({
      where: { id: existing.id },
      data: {
        salesPerson: { connect: { id: userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel: "Media",
      },
    });
    return;
  }
  await context.sudo().query.TechStatusBusinessLead.createOne({
    data: {
      businessLead: { connect: { id: leadId } },
      saasCompany: { connect: { id: companyId } },
      salesPerson: { connect: { id: userId } },
      pipelineStatus: PIPELINE_STATUS.DETECTADO,
      opportunityLevel: "Media",
    },
  });
}

async function logResult(
  context: KeystoneContext,
  userId: string | undefined,
  companyId: string | undefined,
  input: { lat: number; lng: number; radius: number; category: string },
  result: SyncResult,
) {
  if (!userId) return;
  try {
    await context.sudo().query.TechLeadSyncLog.createOne({
      data: {
        user: { connect: { id: userId } },
        ...(companyId ? { company: { connect: { id: companyId } } } : {}),
        success: result.success,
        message: result.message,
        created: result.created,
        alreadyInDb: result.alreadyInDb,
        skippedLowRating: result.skippedLowRating,
        syncedLeadsCount: result.syncedLeadsCount,
        syncedCount: result.syncedCount,
        leadLimit: result.leadLimit,
        lat: input.lat,
        lng: input.lng,
        radius: input.radius,
        category: input.category,
      },
    });
  } catch (_) {}
}

function leadDataFromEstablishment(
  establishment: EstablishmentRow,
  category: string,
  companyId: string,
  userId: string,
) {
  return {
    businessName: establishment.name,
    category,
    phone: establishment.phone || "",
    email: establishment.email || "",
    address: formatEstablishmentAddress({
      clee: establishment.clee,
      name: establishment.name,
      legalName: establishment.legalName ?? "",
      employeeStratum: "",
      scianCode: null,
      scianName: null,
      street: establishment.street ?? "",
      exteriorNumber: establishment.exteriorNumber ?? "",
      interiorNumber: "",
      neighborhood: establishment.neighborhood ?? "",
      postalCode: establishment.postalCode ?? "",
      locality: establishment.locality ?? "",
      municipality: establishment.municipality ?? "",
      state: establishment.state ?? "",
      phone: "",
      email: "",
      website: "",
      lat: null,
      lng: null,
      rawPayload: {},
    }),
    city: establishment.locality || establishment.municipality || "",
    state: establishment.state || "",
    country: "México",
    hasWebsite: Boolean(establishment.website),
    websiteUrl: establishment.website || "",
    source: LEAD_SOURCE.INEGI,
    lat: establishment.lat ?? null,
    lng: establishment.lng ?? null,
    sourceEstablishment: { connect: { id: establishment.id } },
    saasCompany: { connect: [{ id: companyId }] },
    salesPerson: { connect: [{ id: userId }] },
  };
}

type AssignKind = "skipped" | "assigned" | "created";

async function assignEstablishment(
  context: KeystoneContext,
  establishment: EstablishmentRow,
  companyId: string,
  userId: string,
  category: string,
): Promise<AssignKind> {
  const [existing] = (await context.sudo().query.TechBusinessLead.findMany({
    where: { sourceEstablishment: { id: { equals: establishment.id } } },
    take: 1,
    query: "id saasCompany { id }",
  })) as Array<{ id: string; saasCompany?: Array<{ id: string }> | null }>;

  if (existing) {
    const already = (existing.saasCompany ?? []).some(
      (c) => c.id === companyId,
    );
    if (already) return "skipped";
    await context.sudo().query.TechBusinessLead.updateOne({
      where: { id: existing.id },
      data: {
        saasCompany: { connect: [{ id: companyId }] },
        salesPerson: { connect: [{ id: userId }] },
      },
    });
    await ensureStatus(context, existing.id, companyId, userId);
    return "assigned";
  }

  const lead = await context.sudo().query.TechBusinessLead.createOne({
    data: leadDataFromEstablishment(
      establishment,
      category,
      companyId,
      userId,
    ) as any,
    query: "id",
  });
  await ensureStatus(context, lead.id, companyId, userId);
  return "created";
}

const resolver = {
  syncLeadsFromInegi: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        lat: number;
        lng: number;
        radius: number;
        category: string;
        maxResults?: number;
      };
    },
    context: KeystoneContext,
  ): Promise<SyncResult> => {
    const empty = emptyFields();
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;

    if (!userId) {
      return {
        success: false,
        message: MSG.login,
        ...empty,
      };
    }

    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }",
    });
    const company = (user as { company?: { id: string; name?: string } | null })
      ?.company;

    if (!company?.id) {
      const result = {
        success: false,
        message: MSG.noCompany,
        ...empty,
      };
      await logResult(context, userId, undefined, input, result);
      return result;
    }

    const credits = await getRemainingCredits(context, company.id);
    const { remainingQuota, syncedCount, leadLimit } = credits;

    if (credits.blockingReason === "no_subscription") {
      const result = {
        success: false,
        message: MSG.noSubscription,
        ...empty,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }
    if (credits.blockingReason === "free_plan_expired") {
      const result = {
        success: false,
        message: MSG.freeExpired,
        ...empty,
        leadLimit: 0,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }
    if (credits.blockingReason === "no_lead_limit") {
      const result = {
        success: false,
        message: MSG.noLeadLimit,
        ...empty,
        leadLimit,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }
    if (credits.blockingReason === "lead_limit_too_low") {
      const result = {
        success: false,
        message: MSG.leadLimitTooLow,
        ...empty,
        leadLimit,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }
    if (remainingQuota === 0) {
      const result = {
        success: false,
        message: MSG.quotaFull(syncedCount, leadLimit),
        ...empty,
        syncedCount,
        leadLimit,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }

    const maxResults = Math.min(
      Math.max(1, input.maxResults ?? DEFAULT_MAX_RESULTS),
      remainingQuota,
      DEFAULT_MAX_RESULTS,
    );
    const category = input.category.trim();
    const search = resolveDenueSearch(category);
    const { lat, lng, radius: radiusKm } = input;

    const existingLeads = (await context
      .sudo()
      .query.TechBusinessLead.findMany({
        where: {
          AND: [
            { source: { equals: LEAD_SOURCE.INEGI } },
            ...boundingBoxFilters(lat, lng, radiusKm),
            ...(search.isCatchAll
              ? []
              : [
                  {
                    OR: [
                      ...denueContains(search.keyword).map((contains) => ({
                        category: contains,
                      })),
                      ...denueContains(category).map((contains) => ({
                        category: contains,
                      })),
                    ],
                  },
                ]),
          ],
        },
        take: CATALOG_TAKE,
        query: "id lat lng saasCompany { id }",
      })) as Array<{
      id: string;
      lat: number | null;
      lng: number | null;
      saasCompany?: Array<{ id: string }>;
    }>;

    const toAssignFromCrm: string[] = [];
    for (const lead of existingLeads) {
      if (toAssignFromCrm.length >= maxResults) break;
      if (!inRadius(lat, lng, lead.lat, lead.lng, radiusKm)) continue;
      const already = (lead.saasCompany ?? []).some((c) => c.id === company.id);
      if (already) continue;
      toAssignFromCrm.push(lead.id);
    }

    let assignedFromDb = 0;
    for (const leadId of toAssignFromCrm) {
      try {
        await context.sudo().query.TechBusinessLead.updateOne({
          where: { id: leadId },
          data: {
            saasCompany: { connect: [{ id: company.id }] },
            salesPerson: { connect: [{ id: userId }] },
          },
        });
        await ensureStatus(context, leadId, company.id, userId);
        assignedFromDb += 1;
      } catch (_) {}
    }

    let syncedThisRequest = assignedFromDb;
    let currentSyncedCount = syncedCount;
    let created = 0;
    let alreadyInDb = assignedFromDb;

    if (assignedFromDb > 0) {
      const consumeResult = await consumeCompanyCredits(context, {
        companyId: company.id,
        amount: assignedFromDb,
        referenceType: "sync",
        notes: "Leads INEGI asignados desde BD",
      });
      if (!consumeResult.success) {
        const result = {
          success: false,
          message: MSG.quotaFull(
            consumeResult.syncedCount,
            consumeResult.leadLimit,
          ),
          ...empty,
          syncedCount: consumeResult.syncedCount,
          leadLimit: consumeResult.leadLimit,
        };
        await logResult(context, userId, company.id, input, result);
        return result;
      }
      currentSyncedCount = consumeResult.syncedCount;
    }

    if (
      syncedThisRequest >= maxResults ||
      (leadLimit !== null && currentSyncedCount >= leadLimit)
    ) {
      const result: SyncResult = {
        success: true,
        message: MSG.added(assignedFromDb),
        created: 0,
        alreadyInDb: assignedFromDb,
        skippedLowRating: 0,
        syncedLeadsCount: assignedFromDb,
        syncedCount: currentSyncedCount,
        leadLimit,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }

    const catalogWhere = {
      AND: [
        ...boundingBoxFilters(lat, lng, radiusKm),
        ...(search.isCatchAll
          ? []
          : [
              {
                OR: denueKeywordVariants(search.keyword).flatMap((word) => [
                  { name: { contains: word, mode: "insensitive" as const } },
                  {
                    legalName: {
                      contains: word,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    economicActivity: {
                      name: { contains: word, mode: "insensitive" as const },
                    },
                  },
                ]),
              },
            ]),
      ],
    };

    const catalogRows = (await context
      .sudo()
      .query.TechInegiEstablishment.findMany({
        where: catalogWhere,
        take: CATALOG_TAKE,
        query: ESTABLISHMENT_QUERY,
      })) as EstablishmentRow[];

    const nearbyCatalog = catalogRows
      .filter((row) => inRadius(lat, lng, row.lat, row.lng, radiusKm))
      .sort((a, b) => {
        const da = haversineDistance(
          lat,
          lng,
          a.lat as number,
          a.lng as number,
        );
        const db = haversineDistance(
          lat,
          lng,
          b.lat as number,
          b.lng as number,
        );
        return da - db;
      });

    const token = process.env.INEGI_DENUE_TOKEN?.trim();
    const stillNeed = maxResults - syncedThisRequest;
    if (nearbyCatalog.length < stillNeed && token) {
      const radiusMeters = Math.min(
        Math.max(1, Math.round(radiusKm * 1000)),
        DENUE_MAX_RADIUS_METERS,
      );
      try {
        const apiRows = await searchByLocation({
          lat,
          lng,
          radiusMeters,
          keyword: search.keyword,
        });
        const upsertedClees: string[] = [];
        for (const raw of apiRows) {
          const mapped = mapDenueApiRow(raw);
          if (!mapped) continue;
          await upsertEstablishment(context, mapped);
          upsertedClees.push(mapped.clee);
        }
        // DENUE ya filtró por keyword; no re-filtrar con contains (tildes / singular).
        const uniqueClees = [...new Set(upsertedClees)];
        const fromApi = uniqueClees.length
          ? ((await context.sudo().query.TechInegiEstablishment.findMany({
              where: { clee: { in: uniqueClees } },
              take: CATALOG_TAKE,
              query: ESTABLISHMENT_QUERY,
            })) as EstablishmentRow[])
          : [];
        const ids = new Set(nearbyCatalog.map((row) => row.id));
        for (const row of fromApi) {
          if (ids.has(row.id)) continue;
          if (!inRadius(lat, lng, row.lat, row.lng, radiusKm)) continue;
          nearbyCatalog.push(row);
          ids.add(row.id);
        }
        nearbyCatalog.sort((a, b) => {
          const da = haversineDistance(
            lat,
            lng,
            a.lat as number,
            a.lng as number,
          );
          const db = haversineDistance(
            lat,
            lng,
            b.lat as number,
            b.lng as number,
          );
          return da - db;
        });
      } catch (err) {
        console.error("[syncLeadsFromInegi] DENUE search failed", err);
        if (nearbyCatalog.length === 0 && syncedThisRequest === 0) {
          const result = {
            success: false,
            message: MSG.searchFailed,
            ...empty,
            syncedCount: currentSyncedCount,
            leadLimit,
          };
          await logResult(context, userId, company.id, input, result);
          return result;
        }
      }
    } else if (
      nearbyCatalog.length === 0 &&
      !token &&
      syncedThisRequest === 0
    ) {
      const result = {
        success: false,
        message: MSG.searchFailed,
        ...empty,
        syncedCount: currentSyncedCount,
        leadLimit,
      };
      await logResult(context, userId, company.id, input, result);
      return result;
    }

    let assignedFromCatalog = 0;
    for (const establishment of nearbyCatalog) {
      if (syncedThisRequest >= maxResults) break;
      if (leadLimit !== null && currentSyncedCount >= leadLimit) break;
      try {
        const kind = await assignEstablishment(
          context,
          establishment,
          company.id,
          userId,
          search.isCatchAll
            ? establishment.economicActivity?.name || "Negocio"
            : category || search.keyword || "Negocio",
        );
        if (kind === "skipped") continue;
        if (kind === "created") created += 1;
        else {
          alreadyInDb += 1;
          assignedFromCatalog += 1;
        }
        syncedThisRequest += 1;
        currentSyncedCount += 1;
      } catch (_) {}
    }

    const chargedNow = created + assignedFromCatalog;
    if (chargedNow > 0) {
      const consumeResult = await consumeCompanyCredits(context, {
        companyId: company.id,
        amount: chargedNow,
        referenceType: "sync",
        notes: "Leads sincronizados desde INEGI DENUE",
      });
      if (consumeResult.success) {
        currentSyncedCount = consumeResult.syncedCount;
      }
    }

    const result: SyncResult = {
      success: true,
      message:
        syncedThisRequest === 0 ? MSG.noneFound : MSG.added(syncedThisRequest),
      created,
      alreadyInDb,
      skippedLowRating: 0,
      syncedLeadsCount: syncedThisRequest,
      syncedCount: currentSyncedCount,
      leadLimit,
    };
    await logResult(context, userId, company.id, input, result);
    return result;
  },
};

export default { typeDefs, definition, resolver };
