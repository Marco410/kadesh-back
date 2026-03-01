import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../models/Tech/crm/constants";

const typeDefs = `
  input ImportBusinessLeadFromGoogleInput {
    placeId: String!
    category: String
    assignedSellerId: ID
  }

  type ImportBusinessLeadFromGoogleResult {
    success: Boolean!
    message: String!
    businessLeadId: ID
  }

  type Mutation {
    importBusinessLeadFromGoogle(input: ImportBusinessLeadFromGoogleInput!): ImportBusinessLeadFromGoogleResult!
  }
`;

const definition = `
  importBusinessLeadFromGoogle(input: ImportBusinessLeadFromGoogleInput!): ImportBusinessLeadFromGoogleResult!
`;

async function getPlaceDetails(placeId: string, apiKey: string) {
  const fields =
    "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}

function parseAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
) {
  let city = "";
  let state = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
  }
  return { city, state };
}

const resolver = {
  importBusinessLeadFromGoogle: async (
    _root: unknown,
    {
      input,
    }: {
      input: { placeId: string; category?: string; assignedSellerId?: string };
    },
    context: KeystoneContext,
  ) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        businessLeadId: null,
      };
    }

    const existing = await context.sudo().query.TechBusinessLead.findOne({
      where: { googlePlaceId: input.placeId },
      query: "id",
    });
    if (existing) {
      return {
        success: false,
        message: "Este negocio ya fue importado como lead",
        businessLeadId: existing.id,
      };
    }

    const place = await getPlaceDetails(input.placeId, apiKey);
    if (!place) {
      return {
        success: false,
        message: "No se pudo obtener datos del lugar",
        businessLeadId: null,
      };
    }

    const { city, state } = parseAddressComponents(
      place.address_components || [],
    );
    const address = place.formatted_address || "";
    const hasWebsite = !!place.website;

    const data: Record<string, unknown> = {
      businessName: place.name,
      category: input.category || place.types?.[0] || "Negocio",
      phone:
        place.formatted_phone_number || place.international_phone_number || "",
      address,
      city: city || "",
      state: state || "",
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      hasWebsite,
      source: "Google Maps",
      pipelineStatus: PIPELINE_STATUS.DETECTADO,
      opportunityLevel: "Media",
      googlePlaceId: input.placeId,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${input.placeId}`,
    };

    if (input.assignedSellerId) {
      data.assignedSeller = { connect: { id: input.assignedSellerId } };
    }

    try {
      const lead = await context.sudo().query.TechBusinessLead.createOne({
        data: data as any,
      });
      return {
        success: true,
        message: "Lead importado correctamente",
        businessLeadId: lead.id,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error creando lead",
        businessLeadId: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
