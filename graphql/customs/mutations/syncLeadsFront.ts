import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../models/Tech/crm/constants";

const typeDefs = `
  input SyncLeadsFrontInput {
    placeId: String!
    category: String
    assignedSellerId: ID
  }

  type SyncLeadsFrontResult {
    success: Boolean!
    message: String!
    businessLeadId: ID
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
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}

/** Get or create SaasCompanyMonthlyLeadSync for company + year + month; return record id and current syncedCount */
async function getOrCreateMonthlyRecord(
  context: KeystoneContext,
  companyId: string,
  year: number,
  month: number,
): Promise<{ id: string; syncedCount: number }> {
  const existing = await context.sudo().query.SaasCompanyMonthlyLeadSync.findOne({
    where: {
      company: { id: { equals: companyId } },
      year: { equals: year },
      month: { equals: month },
    },
    query: "id syncedCount",
  });
  if (existing) {
    return {
      id: existing.id,
      syncedCount: (existing as { syncedCount: number | null }).syncedCount ?? 0,
    };
  }
  const created = await context.sudo().query.SaasCompanyMonthlyLeadSync.createOne({
    data: {
      company: { connect: { id: companyId } },
      year,
      month,
      syncedCount: 0,
    },
    query: "id syncedCount",
  });
  return {
    id: created.id,
    syncedCount: (created as { syncedCount: number | null }).syncedCount ?? 0,
  };
}

const resolver = {
  syncLeadsFront: async (
    _root: unknown,
    {
      input,
    }: {
      input: { placeId: string; category?: string; assignedSellerId?: string };
    },
    context: KeystoneContext,
  ) => {
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para sincronizar leads",
        businessLeadId: null,
        syncedCount: null,
        leadLimit: null,
      };
    }

    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id plan { leadLimit } }",
    });
    const company = (user as { company?: { id: string; plan?: { leadLimit: number | null } } | null })
      ?.company;
    if (!company?.id) {
      return {
        success: false,
        message: "Tu usuario no tiene una empresa asignada",
        businessLeadId: null,
        syncedCount: null,
        leadLimit: null,
      };
    }

    const leadLimit = company.plan?.leadLimit ?? null;
    if (leadLimit !== null && leadLimit < 1) {
      return {
        success: false,
        message: "El plan de tu empresa no permite sincronizar leads",
        businessLeadId: null,
        syncedCount: null,
        leadLimit,
      };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { id: recordId, syncedCount } = await getOrCreateMonthlyRecord(
      context,
      company.id,
      year,
      month,
    );

    if (leadLimit !== null && syncedCount >= leadLimit) {
      return {
        success: false,
        message: `Cuota mensual alcanzada (${syncedCount}/${leadLimit} leads). Próximo reinicio el mes siguiente.`,
        businessLeadId: null,
        syncedCount,
        leadLimit,
      };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        businessLeadId: null,
        syncedCount: null,
        leadLimit,
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
        syncedCount,
        leadLimit,
      };
    }

    const place = await getPlaceDetails(input.placeId, apiKey);
    if (!place) {
      return {
        success: false,
        message: "No se pudo obtener datos del lugar",
        businessLeadId: null,
        syncedCount: null,
        leadLimit,
      };
    }

    const { city, state, country } = parseAddressComponents(
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
      country: country || "",
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      hasWebsite,
      websiteUrl: place.website || "",
      source: "Google Maps",
      googlePlaceId: input.placeId,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${input.placeId}`,
    };

    if (input.assignedSellerId) {
      data.salesPerson = { connect: { id: input.assignedSellerId } };
    }

    try {
      const lead = await context.sudo().query.TechBusinessLead.createOne({
        data: data as any,
      });
      await context.sudo().query.TechStatusBusinessLead.createOne({
        data: {
          businessLead: { connect: { id: lead.id } },
          pipelineStatus: PIPELINE_STATUS.DETECTADO,
          opportunityLevel: "Media",
        },
      });

      const newCount = syncedCount + 1;
      await context.sudo().query.SaasCompanyMonthlyLeadSync.updateOne({
        where: { id: recordId },
        data: { syncedCount: newCount },
      });

      return {
        success: true,
        message: "Lead importado correctamente",
        businessLeadId: lead.id,
        syncedCount: newCount,
        leadLimit,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error creando lead",
        businessLeadId: null,
        syncedCount: null,
        leadLimit,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
