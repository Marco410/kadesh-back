import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";

type SyncLeadsFrontLinkedinResult = {
  success: boolean;
  message: string;
  syncedLeadsCount: number;
  syncedCount: number | null;
  leadLimit: number | null;
};

const typeDefs = `
  input SyncLeadsFrontLinkedinInput {
    companyIndustry: String!
    contactLocation: String!
    emailStatus: String!
    fetchCount: String!
    contactCity: String
    minRevenue: String
    maxRevenue: String
    sizeCompany: String
    contactJobTitle: String
    seniorityLevel: String
    functionalLevel: String
    companyKeywords: String
  }

  type SyncLeadsFrontLinkedinResult {
    success: Boolean!
    message: String!
    syncedLeadsCount: Int!
    syncedCount: Int
    leadLimit: Int
  }

  type Mutation {
    syncLeadsFrontLinkedin(input: SyncLeadsFrontLinkedinInput!): SyncLeadsFrontLinkedinResult!
  }
`;

const definition = `
  syncLeadsFrontLinkedin(input: SyncLeadsFrontLinkedinInput!): SyncLeadsFrontLinkedinResult!
`;

const resolver = {
  syncLeadsFrontLinkedin: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        companyIndustry: string;
        contactLocation: string;
        emailStatus: string;
        fetchCount: string;
        contactCity?: string | null;
        minRevenue?: string | null;
        maxRevenue?: string | null;
        sizeCompany?: string | null;
        contactJobTitle?: string | null;
        seniorityLevel?: string | null;
        functionalLevel?: string | null;
        companyKeywords?: string | null;
      };
    },
    context: KeystoneContext,
  ) => {

    const emptyResult = {
      syncedLeadsCount: 0,
      syncedCount: 0,
      leadLimit: 0,
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
      //await logSyncLeadsResult(context, userId, undefined, input, result);
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
        message: `"${company?.name ?? "La empresa"}" no tiene una suscripción activa. Contrata o activa una suscripción para sincronizar leads desde LinkedIn.`,
        ...emptyResult,
      };
      return result;
    }

  },
};

export default { typeDefs, definition, resolver };
