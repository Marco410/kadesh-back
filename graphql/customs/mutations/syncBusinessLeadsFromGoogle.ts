import { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../models/Role/constants";
import { PIPELINE_STATUS } from "../../../models/Tech/crm/constants";

/** Obtiene los IDs de usuarios con salesPersonVerified = true, para asignación round-robin de leads. */
async function getVerifiedSalesPersonIds(
  context: KeystoneContext,
): Promise<string[]> {
  const users = await context.sudo().query.User.findMany({
    where: {
      salesPersonVerified: { equals: true },
      roles: { some: { name: { equals: Role.VENDEDOR } } },
    },
    query: "id",
  });
  return users.map((u) => u.id);
}

const MIN_RATING = 4;
const MIN_REVIEWS = 20;
const DEFAULT_MAX_RESULTS = 60;

const typeDefs = `
  input SyncBusinessLeadsFromGoogleInput {
    lat: Float!
    lng: Float!
    radius: Float!
    category: String!
    assignedSellerId: ID
    maxResults: Int
  }

  type SyncBusinessLeadsFromGoogleResult {
    success: Boolean!
    message: String!
    created: Int!
    alreadyInDb: Int!
    skippedLowRating: Int!
  }

  type Mutation {
    syncBusinessLeadsFromGoogle(input: SyncBusinessLeadsFromGoogleInput!): SyncBusinessLeadsFromGoogleResult!
  }
`;

const definition = `
  syncBusinessLeadsFromGoogle(input: SyncBusinessLeadsFromGoogleInput!): SyncBusinessLeadsFromGoogleResult!
`;

const PROMPT_PREFIX =
  "Escribe un prompt que pueda usar en un vibe coding software para crear un sitio web atractivo, para una empresa que no tiene pagina web ahorita mismo, muestra funcionalidades que se puedan implementar en un sitio web para el negocio con la info: ";

const MIN_POSITIVE_REVIEW_RATING = 4;

async function getPlaceDetails(placeId: string, apiKey: string) {
  const fields =
    "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry,reviews";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}

function formatReview(review: {
  author_name?: string;
  rating?: number;
  text?: string;
}) {
  const author = review.author_name || "Anónimo";
  const rating = review.rating ?? 0;
  const text = (review.text || "").trim();
  return `⭐ ${rating} - ${author}: ${text}`;
}

function buildReviewsAndPrompt(
  details: {
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: Array<{ author_name?: string; rating?: number; text?: string }>;
  },
  category: string,
): { topReviews: string[]; websitePromptContent: string } {
  const positiveReviews = (details.reviews || [])
    .filter(
      (r) =>
        (r.rating ?? 0) >= MIN_POSITIVE_REVIEW_RATING && (r.text || "").trim(),
    )
    .slice(0, 5)
    .map(formatReview);

  const topReviews = [
    positiveReviews[0] || "",
    positiveReviews[1] || "",
    positiveReviews[2] || "",
    positiveReviews[3] || "",
    positiveReviews[4] || "",
  ];

  const lines = [
    `Negocio: ${details.name || ""}`,
    `Categoría: ${category}`,
    `Dirección: ${details.formatted_address || ""}`,
    `Teléfono: ${details.formatted_phone_number || ""}`,
    `Sitio web actual: ${details.website ? "Sí" : "No tiene"}`,
    `Valoración: ${details.rating ?? "-"} (${details.user_ratings_total ?? 0} reseñas)`,
    "",
    "Reseñas positivas de Google:",
    ...positiveReviews.map((r) => `- ${r}`),
  ];
  const businessInfo = lines.join("\n");
  const websitePromptContent = PROMPT_PREFIX + businessInfo;

  return { topReviews, websitePromptContent };
}

function parseAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
) {
  let city = "";
  let state = "";
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}

const resolver = {
  syncBusinessLeadsFromGoogle: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        lat: number;
        lng: number;
        radius: number;
        category: string;
        assignedSellerId?: string;
        maxResults?: number;
      };
    },
    context: KeystoneContext,
  ) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        created: 0,
        alreadyInDb: 0,
        skippedLowRating: 0,
      };
    }

    const {
      lat,
      lng,
      radius,
      category,
      assignedSellerId,
      maxResults = DEFAULT_MAX_RESULTS,
    } = input;

    const radiusMeters = Math.round(radius * 1000);
    const keyword = encodeURIComponent(category);
    let created = 0;
    let alreadyInDb = 0;
    let skippedLowRating = 0;
    let nextPageToken: string | undefined;

    const verifiedSellerIds = await getVerifiedSalesPersonIds(context);

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
          return {
            success: false,
            message: data.error_message || data.status,
            created,
            alreadyInDb,
            skippedLowRating,
          };
        }

        const results = data.results || [];
        for (const place of results) {
          if (created + alreadyInDb + skippedLowRating >= maxResults) break;

          const placeId = place.place_id;
          const placeRating = place.rating ?? 0;
          const userRatingsTotal = place.user_ratings_total ?? 0;

          const existing = await context.sudo().query.TechBusinessLead.findOne({
            where: { googlePlaceId: placeId },
            query: "id",
          });
          if (existing) {
            alreadyInDb++;
            continue;
          }

          if (placeRating < MIN_RATING || userRatingsTotal < MIN_REVIEWS) {
            skippedLowRating++;
            continue;
          }

          const details = await getPlaceDetails(placeId, apiKey);
          if (!details) continue;

          const { city: parsedCity, state, country } = parseAddressComponents(
            details.address_components || [],
          );
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
          };
          const sellerId = assignedSellerId
            ? assignedSellerId
            : verifiedSellerIds.length > 0
              ? verifiedSellerIds[created % verifiedSellerIds.length]
              : null;
          if (sellerId) {
            leadData.salesPerson = { connect: { id: sellerId } };
          }

          try {
            const lead = await context.sudo().query.TechBusinessLead.createOne({
              data: leadData as any,
            });
            await context.sudo().query.TechStatusBusinessLead.createOne({
              data: {
                businessLead: { connect: { id: lead.id } },
                pipelineStatus: PIPELINE_STATUS.DETECTADO,
                opportunityLevel: "Media",
              },
            });
            created++;
          } catch (_) {
            // skip on duplicate or validation error
          }
        }

        nextPageToken = data.next_page_token;
      } while (
        nextPageToken &&
        created + alreadyInDb + skippedLowRating < maxResults
      );

      return {
        success: true,
        message: `Sincronización completada. Creados: ${created}. Ya en BD: ${alreadyInDb}. Descartados (rating < ${MIN_RATING} o reseñas < ${MIN_REVIEWS}): ${skippedLowRating}.`,
        created,
        alreadyInDb,
        skippedLowRating,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error en sincronización",
        created,
        alreadyInDb,
        skippedLowRating,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
