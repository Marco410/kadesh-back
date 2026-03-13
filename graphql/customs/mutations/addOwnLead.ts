import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS, LEAD_SOURCE } from "../../../models/Tech/crm/constants";
import { SUBSCRIPTION_STATUS } from "../../../models/Saas/SaasCompanySubscription/constants";

const ADD_OWN_LEADS_FEATURE_KEY = "add_own_leads";

type PlanFeature = { key: string; name: string; description: string };

function subscriptionHasFeature(
  planFeatures: unknown,
  featureKey: string,
): boolean {
  if (!Array.isArray(planFeatures)) return false;
  return (planFeatures as PlanFeature[]).some((f) => f.key === featureKey);
}

const typeDefs = `
  input AddOwnLeadInput {
    businessName: String!
    category: String
    phone: String
    address: String
    city: String
    state: String
    country: String
    email: String
    websiteUrl: String
    instagram: String
    facebook: String
    xTwitter: String
    tiktok: String
    lat: Float
    lng: Float
    source: String
    notes: String
    opportunityLevel: String
    topReview1: String
    topReview2: String
    topReview3: String
    topReview4: String
    topReview5: String
  }

  type AddOwnLeadResult {
    success: Boolean!
    message: String!
    leadId: String
  }

  type Mutation {
    addOwnLead(input: AddOwnLeadInput!): AddOwnLeadResult!
  }
`;

const definition = `
  addOwnLead(input: AddOwnLeadInput!): AddOwnLeadResult!
`;

const resolver = {
  addOwnLead: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        businessName: string;
        category?: string;
        phone?: string;
        email?: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        websiteUrl?: string;
        instagram?: string;
        facebook?: string;
        xTwitter?: string;
        tiktok?: string;
        lat?: number;
        lng?: number;
        source?: string;
        notes?: string;
        opportunityLevel?: string;
        topReview1?: string;
        topReview2?: string;
        topReview3?: string;
        topReview4?: string;
        topReview5?: string;
      };
    },
    context: KeystoneContext,
  ) => {
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para agregar leads",
        leadId: null,
      };
    }

    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }",
    });

    const company = (user as { company?: { id: string; name?: string } | null })
      ?.company;

    if (!company?.id) {
      return {
        success: false,
        message: "Tu usuario no tiene una empresa asignada",
        leadId: null,
      };
    }

    const [activeSubscription] = await context
      .sudo()
      .query.SaasCompanySubscription.findMany({
        where: {
          company: { id: { equals: company.id } },
          status: {
            in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING],
          },
        },
        orderBy: [{ activatedAt: "desc" }],
        take: 1,
        query: "id planFeatures",
      });

    if (!activeSubscription) {
      return {
        success: false,
        message: `"${company.name ?? "La empresa"}" no tiene una suscripción activa.`,
        leadId: null,
      };
    }

    const sub = activeSubscription as { planFeatures: unknown };
    if (!subscriptionHasFeature(sub.planFeatures, ADD_OWN_LEADS_FEATURE_KEY)) {
      return {
        success: false,
        message:
          "Tu plan actual no incluye la funcionalidad de agregar leads propios. Actualiza tu suscripción para desbloquear esta función.",
        leadId: null,
      };
    }

    const validSources = Object.values(LEAD_SOURCE) as string[];
    const source =
      input.source && validSources.includes(input.source)
        ? input.source
        : LEAD_SOURCE.OTRO;

    try {
      const newLead = await context.sudo().query.TechBusinessLead.createOne({
        data: {
          businessName: input.businessName,
          category: input.category ?? "",
          phone: input.phone ?? "",
          email: input.email ?? "",
          address: input.address ?? "",
          city: input.city ?? "",
          state: input.state ?? "",
          country: input.country ?? "",
          hasWebsite: !!input.websiteUrl,
          websiteUrl: input.websiteUrl ?? "",
          instagram: input.instagram ?? "",
          facebook: input.facebook ?? "",
          xTwitter: input.xTwitter ?? "",
          tiktok: input.tiktok ?? "",
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          source,
          topReview1: input.topReview1 ?? "",
          topReview2: input.topReview2 ?? "",
          topReview3: input.topReview3 ?? "",
          topReview4: input.topReview4 ?? "",
          topReview5: input.topReview5 ?? "",
          saasCompany: { connect: { id: company.id } },
          salesPerson: { connect: { id: userId } },
        },
      });

      await context.sudo().query.TechStatusBusinessLead.createOne({
        data: {
          businessLead: { connect: { id: newLead.id } },
          saasCompany: { connect: { id: company.id } },
          salesPerson: { connect: { id: userId } },
          pipelineStatus: PIPELINE_STATUS.DETECTADO,
          opportunityLevel: (["Alta", "Media", "Baja"].includes(input.opportunityLevel ?? "")) ? input.opportunityLevel! : "Media",
          notes: input.notes ?? "",
        },
      });

      return {
        success: true,
        message: "Lead agregado exitosamente",
        leadId: newLead.id,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : "Error al crear el lead",
        leadId: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
