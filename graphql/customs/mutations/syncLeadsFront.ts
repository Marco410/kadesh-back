import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../models/Tech/crm/constants";
import { haversineDistance } from "../../../utils/helpers/calculate_distances";
import { SUBSCRIPTION_STATUS } from "../../../models/Saas/SaasCompanySubscription/constants";
import { buildReviewsAndPrompt } from "../../../utils/helpers/tech/build_prompt_text";
import { parseAddressComponents } from "../../../utils/helpers/tech/parse_address";
import { getOrCreateMonthlyRecord } from "../../../utils/helpers/tech/monthly_record";
import { getPlaceDetails } from "../../../utils/helpers/tech/place_details";
import { getFreePlanTrialInfo } from "../../../utils/saas/freePlanTrial";

/**
 * syncLeadsFront: asigna TechBusinessLead a la SaasCompany del usuario.
 * Relación N:M: un mismo lead puede estar en varias companies; solo usamos connect (nunca set/disconnect).
 * Mismo punto (lat/lng/radius/category) debe dar el mismo pool de leads para cualquier company.
 */
/** Asegura que exista TechStatusBusinessLead para este lead + company con salesPerson; crea o actualiza. */
async function ensureStatusForLeadAssignment(
  context: KeystoneContext,
  leadId: string,
  companyId: string,
  userId: string,
  opportunityLevel: "Alta" | "Media" | "Baja" = "Media",
): Promise<void> {
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
      where: { id: (existing as { id: string }).id },
      data: {
        salesPerson: { connect: { id: userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel,
      },
    });
  } else {
    await context.sudo().query.TechStatusBusinessLead.createOne({
      data: {
        businessLead: { connect: { id: leadId } },
        saasCompany: { connect: { id: companyId } },
        salesPerson: { connect: { id: userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel,
      },
    });
  }
}

const MIN_RATING = 0;
const MIN_REVIEWS = 0;
const DEFAULT_MAX_RESULTS = 60;

type SyncLeadsResult = {
  success: boolean;
  message: string;
  created: number;
  alreadyInDb: number;
  skippedLowRating: number;
  syncedLeadsCount: number;
  syncedCount: number | null;
  leadLimit: number | null;
};

async function logSyncLeadsResult(
  context: KeystoneContext,
  userId: string | undefined,
  companyId: string | undefined,
  input: { lat: number; lng: number; radius: number; category: string },
  result: SyncLeadsResult,
): Promise<void> {
  if (!userId) return;
  try {
    await context.sudo().query.TechLeadSyncLog.createOne({
      data: {
        user: { connect: { id: userId } },
        ...(companyId && { company: { connect: { id: companyId } } }),
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

const typeDefs = `
  input SyncLeadsFrontInput {
    lat: Float!
    lng: Float!
    radius: Float!
    category: String!
    maxResults: Int
    minRating: Float
    minReviews: Int
  }

  type SyncLeadsFrontResult {
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
    syncLeadsFront(input: SyncLeadsFrontInput!): SyncLeadsFrontResult!
  }
`;

const definition = `
  syncLeadsFront(input: SyncLeadsFrontInput!): SyncLeadsFrontResult!
`;

const resolver = {
  syncLeadsFront: async (
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
        minRating?: number;
        minReviews?: number;
      };
    },
    context: KeystoneContext,
  ) => {
    const emptyResult = {
      created: 0,
      alreadyInDb: 0,
      skippedLowRating: 0,
      syncedLeadsCount: 0,
      syncedCount: null as number | null,
      leadLimit: null as number | null,
    };

    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para sincronizar leads",
        ...emptyResult,
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
        message: "Tu usuario no tiene una empresa asignada",
        ...emptyResult,
      };
      await logSyncLeadsResult(context, userId, undefined, input, result);
      return result;
    }

    // Resolver límite desde la suscripción activa o en prueba (snapshot del plan contratado), no del plan actual
    const [activeSubscription] = await context
      .sudo()
      .query.SaasCompanySubscription.findMany({
        where: {
          company: { id: { equals: company.id } },
          status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
        },
        orderBy: [{ activatedAt: "desc" }],
        take: 1,
        query: "id planLeadLimit planCost activatedAt",
      });

    if (!activeSubscription) {
      const result = {
        success: false,
        message: `"${company?.name ?? "La empresa"}" no tiene una suscripción activa. Contrata o activa una suscripción para sincronizar leads.`,
        ...emptyResult,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const sub = activeSubscription as {
      planLeadLimit: number | null;
      planCost?: number | null;
      activatedAt?: string | null;
    };
    const isFreePlan = sub.planCost != null && sub.planCost <= 0;
    if (isFreePlan && sub.activatedAt) {
      const { isExpired } = getFreePlanTrialInfo(sub.activatedAt);
      if (isExpired) {
        const result = {
          success: false,
          message:
            "Tu plan gratuito ha terminado. Contrata o activa una suscripción para poder obtener más clientes.",
          ...emptyResult,
          leadLimit: 0,
        };
        await logSyncLeadsResult(context, userId, company.id, input, result);
        return result;
      }
    }

    const leadLimit = sub.planLeadLimit ?? null;

    if (leadLimit === null) {
      const result = {
        success: false,
        message: `La suscripción activa de "${company?.name ?? "la empresa"}" no tiene límite de leads configurado.`,
        ...emptyResult,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    if (leadLimit < 1) {
      const result = {
        success: false,
        message: `La suscripción activa de "${company?.name ?? "la empresa"}" no permite sincronizar leads.`,
        ...emptyResult,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    const { id: recordId, syncedCount } = await getOrCreateMonthlyRecord(
      context,
      company.id,
      year,
      month,
    );

    // leadLimit viene de la suscripción activa (ya validado arriba)
    const remainingQuota = Math.max(0, leadLimit - syncedCount);
    if (remainingQuota === 0) {
      const result = {
        success: false,
        message: `Cuota mensual de tu suscripción alcanzada (${syncedCount}/${leadLimit} leads). Próximo reinicio el mes siguiente.`,
        ...emptyResult,
        syncedCount,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    const maxResults = Math.min(
      input.maxResults ?? DEFAULT_MAX_RESULTS,
      remainingQuota,
    );

    const minRating =
      typeof input.minRating === "number"
        ? Math.max(0, input.minRating)
        : MIN_RATING;
    const minReviews =
      typeof input.minReviews === "number"
        ? Math.max(0, Math.floor(input.minReviews))
        : MIN_REVIEWS;

    const {
      lat: centerLat,
      lng: centerLng,
      radius: radiusKm,
      category: inputCategory,
    } = input;

    // 1) Buscar TechBusinessLead en BD por categoría, dentro del radio; excluir los que ya están asignados a esta company
    const candidates = await context.sudo().query.TechBusinessLead.findMany({
      where: {
        category: { equals: inputCategory },
      },
      take: 1000,
      query: "id lat lng saasCompany { id }",
    });

    type LeadCandidate = {
      id: string;
      lat: number | null;
      lng: number | null;
      saasCompany?: { id: string }[];
    };
    const existingIds: string[] = [];
    for (const lead of candidates as LeadCandidate[]) {
      if (existingIds.length >= maxResults) break;
      const leadLat = lead.lat;
      const leadLng = lead.lng;
      if (leadLat == null || leadLng == null) continue;
      const distanceKm = haversineDistance(
        centerLat,
        centerLng,
        leadLat,
        leadLng,
      );
      if (distanceKm > radiusKm) continue;
      // No asignar si ya está asignado a esta company
      const alreadyAssignedToThisCompany = (lead.saasCompany ?? []).some(
        (c) => c.id === company.id,
      );
      if (alreadyAssignedToThisCompany) continue;
      existingIds.push(lead.id);
    }

    // Asignar siempre los leads existentes en el área a esta company (solo connect: un mismo lead puede estar en varias companies).
    let assignedFromDb = 0;
    for (const leadId of existingIds) {
      try {
        await context.sudo().query.TechBusinessLead.updateOne({
          where: { id: leadId },
          data: { saasCompany: { connect: { id: company.id } } }, // ADD only; never replace
        });
        await ensureStatusForLeadAssignment(
          context,
          leadId,
          company.id,
          userId,
        );
        assignedFromDb++;
      } catch (_) {}
    }
    let currentSyncedCount = syncedCount + assignedFromDb;
    let syncedThisRequest = assignedFromDb;
    if (assignedFromDb > 0) {
      await context.sudo().query.SaasCompanyMonthlyLeadSync.updateOne({
        where: { id: recordId },
        data: { syncedCount: currentSyncedCount },
      });
    }

    // Si ya alcanzamos maxResults o la cuota, devolver (mismo pool de leads para cualquier company)
    if (
      syncedThisRequest >= maxResults ||
      (leadLimit !== null && currentSyncedCount >= leadLimit)
    ) {
      const result = {
        success: true,
        message: `${assignedFromDb} leads asignados. Cuota: ${currentSyncedCount}${leadLimit !== null ? `/${leadLimit}` : ""} este mes.`,
        created: 0,
        alreadyInDb: assignedFromDb,
        skippedLowRating: 0,
        syncedLeadsCount: assignedFromDb,
        syncedCount: currentSyncedCount,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    // Buscar más en Google Maps si hace falta (crear si no existe, asignar a la company; connect solo, nunca quitar otras companies).
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      if (syncedThisRequest > 0) {
        const result = {
          success: true,
          message: `${syncedThisRequest} leads asignados desde BD. GOOGLE_MAPS_API_KEY no configurada para buscar más. Cuota: ${currentSyncedCount}${leadLimit !== null ? `/${leadLimit}` : ""} este mes.`,
          created: 0,
          alreadyInDb: assignedFromDb,
          skippedLowRating: 0,
          syncedLeadsCount: syncedThisRequest,
          syncedCount: currentSyncedCount,
          leadLimit,
        };
        await logSyncLeadsResult(context, userId, company.id, input, result);
        return result;
      }
      const result = {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        ...emptyResult,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }

    const { lat, lng, radius, category } = input;
    const radiusMeters = Math.round(radius * 1000);
    const keyword = encodeURIComponent(category);
    let created = 0;
    let alreadyInDb = assignedFromDb;
    let skippedLowRating = 0;
    let nextPageToken: string | undefined;
    // currentSyncedCount y syncedThisRequest ya vienen de la asignación de existingIds

    try {
      do {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${keyword}&key=${apiKey}&language=es`;
        if (nextPageToken) {
          url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(nextPageToken)}&key=${apiKey}`;
          await new Promise((r) => setTimeout(r, 2000));
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          const result = {
            success: false,
            message: data.error_message || data.status,
            created,
            alreadyInDb,
            skippedLowRating,
            syncedLeadsCount: syncedThisRequest,
            syncedCount: currentSyncedCount,
            leadLimit,
          };
          await logSyncLeadsResult(context, userId, company.id, input, result);
          return result;
        }

        const results = data.results || [];
        for (const place of results) {
          if (syncedThisRequest >= maxResults) break;
          if (leadLimit !== null && currentSyncedCount >= leadLimit) break;

          const placeId = place.place_id;
          const placeRating = place.rating ?? 0;
          const userRatingsTotal = place.user_ratings_total ?? 0;

          let lead = await context.sudo().query.TechBusinessLead.findOne({
            where: { googlePlaceId: placeId },
            query: "id saasCompany { id }",
          });

          if (lead) {
            const leadCompanies =
              (lead as { id: string; saasCompany?: { id: string }[] })
                .saasCompany ?? [];
            const alreadyAssignedToThisCompany = leadCompanies.some(
              (c) => c.id === company.id,
            );
            if (alreadyAssignedToThisCompany) {
              continue;
            }
            alreadyInDb++;
            try {
              const leadId = (lead as { id: string }).id;
              await context.sudo().query.TechBusinessLead.updateOne({
                where: { id: leadId },
                data: { saasCompany: { connect: { id: company.id } } },
              });
              const level: "Alta" | "Media" | "Baja" =
                placeRating >= 4.5
                  ? "Alta"
                  : placeRating >= 4
                    ? "Media"
                    : "Baja";
              await ensureStatusForLeadAssignment(
                context,
                leadId,
                company.id,
                userId,
                level,
              );
              syncedThisRequest++;
              currentSyncedCount++;
            } catch (_) {}
            continue;
          }

          if (placeRating < minRating || userRatingsTotal < minReviews) {
            skippedLowRating++;
            continue;
          }

          const details = await getPlaceDetails(placeId, apiKey);
          if (!details) continue;

          const {
            city: parsedCity,
            state,
            country,
          } = parseAddressComponents(details.address_components || []);
          const { topReviews, websitePromptContent } = buildReviewsAndPrompt(
            details,
            category,
          );

          const leadData: Record<string, unknown> = {
            businessName: details.name,
            category,
            phone:
              details.formatted_phone_number ||
              details.international_phone_number ||
              "",
            address: details.formatted_address || "",
            city: parsedCity || "",
            state: state || "",
            country: country || "",
            rating: details.rating ?? null,
            reviewCount: details.user_ratings_total ?? null,
            hasWebsite: !!details.website,
            source: "Google Maps",
            googlePlaceId: placeId,
            googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            topReview1: topReviews[0] || null,
            topReview2: topReviews[1] || null,
            topReview3: topReviews[2] || null,
            topReview4: topReviews[3] || null,
            topReview5: topReviews[4] || null,
            websitePromptContent,
            saasCompany: { connect: { id: company.id } },
            lat: details.geometry?.location?.lat ?? null,
            lng: details.geometry?.location?.lng ?? null,
          };

          try {
            const newLead = await context
              .sudo()
              .query.TechBusinessLead.createOne({
                data: leadData as any,
              });
            await context.sudo().query.TechStatusBusinessLead.createOne({
              data: {
                businessLead: { connect: { id: newLead.id } },
                saasCompany: { connect: { id: company.id } },
                salesPerson: { connect: { id: userId } },
                pipelineStatus: PIPELINE_STATUS.DETECTADO,
                opportunityLevel:
                  placeRating >= 4.5
                    ? "Alta"
                    : placeRating >= 4
                      ? "Media"
                      : "Baja",
              },
            });
            created++;
            syncedThisRequest++;
            currentSyncedCount++;
          } catch (_) {
            // skip on duplicate or validation error
          }
        }

        nextPageToken = data.next_page_token;
      } while (
        nextPageToken &&
        syncedThisRequest < maxResults &&
        (leadLimit === null || currentSyncedCount < leadLimit)
      );

      if (syncedThisRequest > 0) {
        await context.sudo().query.SaasCompanyMonthlyLeadSync.updateOne({
          where: { id: recordId },
          data: { syncedCount: currentSyncedCount },
        });
      }

      const result = {
        success: true,
        message: `Sincronización completada. Leads asignados a tu empresa: ${syncedThisRequest} ${leadLimit !== null ? ` Cuota: ${currentSyncedCount}/${leadLimit} este mes.` : ""}`,
        created,
        alreadyInDb,
        skippedLowRating,
        syncedLeadsCount: syncedThisRequest,
        syncedCount: currentSyncedCount,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    } catch (err) {
      const result = {
        success: false,
        message: err instanceof Error ? err.message : "Error en sincronización",
        created,
        alreadyInDb,
        skippedLowRating,
        syncedLeadsCount: syncedThisRequest,
        syncedCount: currentSyncedCount,
        leadLimit,
      };
      await logSyncLeadsResult(context, userId, company.id, input, result);
      return result;
    }
  },
};

export default { typeDefs, definition, resolver };
