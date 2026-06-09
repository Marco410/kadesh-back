import { KeystoneContext } from "@keystone-6/core/types";
import { getRemainingCredits } from "../../../../utils/helpers/tech/remaining_credits";

const BLOCKING_MESSAGES: Record<string, string> = {
  no_subscription:
    "Tu negocio no tiene una suscripción activa. Contrata o activa una suscripción para poder obtener más clientes.",
  free_plan_expired:
    "Tu plan gratuito ha terminado. Contrata o activa una suscripción para poder obtener más clientes.",
  no_lead_limit:
    "La suscripción activa no tiene límite de leads configurado.",
  lead_limit_too_low:
    "La suscripción activa no permite sincronizar leads o te has excedido el límite de leads.",
};

const typeDefs = `
  type RemainingCreditsResult {
    success: Boolean!
    message: String
    remainingQuota: Int!
    syncedCount: Int!
    leadLimit: Int
    planLeadLimit: Int
    extraCredits: Int!
    year: Int!
    month: Int!
  }

  type Mutation {
    remainingCredits(companyId: ID): RemainingCreditsResult!
  }
`;

const definition = `
  remainingCredits(companyId: ID): RemainingCreditsResult!
`;

const resolver = {
  remainingCredits: async (
    _root: unknown,
    { companyId }: { companyId?: string | null },
    context: KeystoneContext,
  ) => {
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;

    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para consultar tus créditos disponibles",
        remainingQuota: 0,
        syncedCount: 0,
        leadLimit: null,
        planLeadLimit: null,
        extraCredits: 0,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      };
    }

    const user = await context.sudo().query.User.findOne({
      where: { id: userId },
      query: "id company { id name }",
    });

    const userCompany = (user as { company?: { id: string; name?: string } | null })?.company;
    const companyIdToUse = companyId ?? userCompany?.id;

    if (!companyIdToUse) {
      return {
        success: false,
        message: "No se encontró un negocio asignado.",
        remainingQuota: 0,
        syncedCount: 0,
        leadLimit: null,
        planLeadLimit: null,
        extraCredits: 0,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      };
    }

    const credits = await getRemainingCredits(context, companyIdToUse);

    if (credits.blockingReason) {
      return {
        success: false,
        message: BLOCKING_MESSAGES[credits.blockingReason] ?? "No hay créditos disponibles.",
        remainingQuota: credits.remainingQuota,
        syncedCount: credits.syncedCount,
        leadLimit: credits.leadLimit,
        planLeadLimit: credits.planLeadLimit,
        extraCredits: credits.extraCredits,
        year: credits.year,
        month: credits.month,
      };
    }

    return {
      success: true,
      message: null,
      remainingQuota: credits.remainingQuota,
      syncedCount: credits.syncedCount,
      leadLimit: credits.leadLimit,
      planLeadLimit: credits.planLeadLimit,
      extraCredits: credits.extraCredits,
      year: credits.year,
      month: credits.month,
    };
  },
};

export default { typeDefs, definition, resolver };
