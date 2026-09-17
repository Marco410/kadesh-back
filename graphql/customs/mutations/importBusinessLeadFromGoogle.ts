import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../models/Saas/Tech/crm/constants";
import { Role } from "../../../models/Role/constants";
import {
  denyOtherCompanyMessage,
  getSessionUserId,
  isSignedIn,
  resolveAuthorizedCompanyId,
} from "../../../utils/access/tenant";

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
  let country = "";
  for (const c of components || []) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("country")) country = c.long_name;
  }
  return { city, state, country };
}

async function ensureStatusForImport(
  context: KeystoneContext,
  leadId: string,
  companyId: string,
  sellerId: string | null,
) {
  const [existing] = await context.sudo().query.TechStatusBusinessLead.findMany({
    where: {
      businessLead: { id: { equals: leadId } },
      saasCompany: { id: { equals: companyId } },
    },
    take: 1,
    query: "id",
  });
  if (existing) return;
  await context.sudo().query.TechStatusBusinessLead.createOne({
    data: {
      businessLead: { connect: { id: leadId } },
      saasCompany: { connect: { id: companyId } },
      ...(sellerId ? { salesPerson: { connect: { id: sellerId } } } : {}),
      pipelineStatus: PIPELINE_STATUS.DETECTADO,
      opportunityLevel: "Media",
    },
  });
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
    if (!isSignedIn(context.session)) {
      return {
        success: false,
        message: "Debes iniciar sesión para importar un lead",
        businessLeadId: null,
      };
    }

    const companyId = resolveAuthorizedCompanyId(context.session);
    if (!companyId) {
      return {
        success: false,
        message: denyOtherCompanyMessage(),
        businessLeadId: null,
      };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY no configurada",
        businessLeadId: null,
      };
    }

    const userId = getSessionUserId(context.session);
    let sellerId: string | null = input.assignedSellerId ?? userId;

    if (input.assignedSellerId) {
      const seller = (await context.sudo().query.User.findOne({
        where: { id: input.assignedSellerId },
        query: "id company { id }",
      })) as { id: string; company?: { id: string } | null } | null;
      if (!seller || seller.company?.id !== companyId) {
        return {
          success: false,
          message: "El vendedor no pertenece a tu empresa",
          businessLeadId: null,
        };
      }
      sellerId = seller.id;
    } else {
      const verifiedSellerIds = await getVerifiedSalesPersonIds(
        context,
        companyId,
      );
      sellerId =
        verifiedSellerIds[0] ?? userId;
    }

    const existing = await context.sudo().query.TechBusinessLead.findOne({
      where: { googlePlaceId: input.placeId },
      query: "id saasCompany { id }",
    });
    if (existing) {
      await context.sudo().query.TechBusinessLead.updateOne({
        where: { id: existing.id },
        data: {
          saasCompany: { connect: [{ id: companyId }] },
          ...(sellerId ? { salesPerson: { connect: [{ id: sellerId }] } } : {}),
        },
      });
      await ensureStatusForImport(context, existing.id, companyId, sellerId);
      return {
        success: true,
        message: "Lead asignado a tu empresa",
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
      lat: place.geometry?.location?.lat ?? null,
      lng: place.geometry?.location?.lng ?? null,
      saasCompany: { connect: [{ id: companyId }] },
    };

    if (sellerId) {
      data.salesPerson = { connect: [{ id: sellerId }] };
    }

    try {
      const lead = await context.sudo().query.TechBusinessLead.createOne({
        data: data as any,
      });
      await ensureStatusForImport(context, lead.id, companyId, sellerId);
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

async function getVerifiedSalesPersonIds(
  context: KeystoneContext,
  companyId: string,
): Promise<string[]> {
  const users = await context.sudo().query.User.findMany({
    where: {
      salesPersonVerified: { equals: true },
      roles: { some: { name: { equals: Role.VENDEDOR } } },
      company: { id: { equals: companyId } },
    },
    query: "id",
  });
  return users.map((u) => u.id);
}

export default { typeDefs, definition, resolver };
