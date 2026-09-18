import { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { grantPurchaseCredits } from "../../../../utils/saas/companyCredits";
import { getRemainingCredits } from "../../../../utils/helpers/tech/remaining_credits";
import {
  COMPANY_CREDIT_LEDGER_REFERENCE_TYPE,
  COMPANY_CREDIT_LEDGER_TYPE,
} from "../../../../models/Saas/SaasCompanyCreditLedger/constants";

const MAX_GRANT = 50_000;

const typeDefs = `
  input GrantAdminCreditsInput {
    companyId: ID!
    subscriptionId: ID!
    amount: Int!
    notes: String
  }

  type GrantAdminCreditsResult {
    success: Boolean!
    message: String!
    creditsAdded: Int
    remainingQuota: Int
    extraCredits: Int
  }

  type Mutation {
    grantAdminCredits(input: GrantAdminCreditsInput!): GrantAdminCreditsResult!
  }
`;

const definition = `
  grantAdminCredits(input: GrantAdminCreditsInput!): GrantAdminCreditsResult!
`;

type GrantAdminCreditsInput = {
  companyId: string;
  subscriptionId: string;
  amount: number;
  notes?: string | null;
};

const resolver = {
  grantAdminCredits: async (
    _root: unknown,
    { input }: { input: GrantAdminCreditsInput },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) {
      return {
        success: false,
        message: "Solo operaciones puede otorgar créditos.",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    const companyId = input.companyId?.trim();
    const subscriptionId = input.subscriptionId?.trim();
    const amount = Math.floor(Number(input.amount));

    if (!companyId || !subscriptionId) {
      return {
        success: false,
        message: "Faltan la empresa o la suscripción.",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    if (!Number.isFinite(amount) || amount < 1) {
      return {
        success: false,
        message: "Indica cuántos créditos agregar (mínimo 1).",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    if (amount > MAX_GRANT) {
      return {
        success: false,
        message: `No se pueden otorgar más de ${MAX_GRANT.toLocaleString("es-MX")} créditos a la vez.`,
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    const [company, subscription] = await Promise.all([
      context.sudo().query.SaasCompany.findOne({
        where: { id: companyId },
        query: "id",
      }),
      context.sudo().query.SaasCompanySubscription.findOne({
        where: { id: subscriptionId },
        query: "id company { id }",
      }),
    ]);

    if (!company) {
      return {
        success: false,
        message: "No se encontró la empresa.",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    if (!subscription) {
      return {
        success: false,
        message: "No se encontró la suscripción.",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    const subscriptionCompanyId = (
      subscription as { company?: { id?: string } | null }
    ).company?.id;

    if (subscriptionCompanyId !== companyId) {
      return {
        success: false,
        message: "La suscripción no pertenece a esa empresa.",
        creditsAdded: null,
        remainingQuota: null,
        extraCredits: null,
      };
    }

    const notes =
      input.notes?.trim() ||
      `Ajuste de créditos desde operaciones (+${amount})`;

    await grantPurchaseCredits(context, {
      companyId,
      subscriptionId,
      amount,
      notes,
      ledgerType: COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN,
      referenceType: COMPANY_CREDIT_LEDGER_REFERENCE_TYPE.ADMIN,
      referenceId: context.session?.data?.id ?? null,
    });

    const credits = await getRemainingCredits(context, companyId);

    return {
      success: true,
      message: `Se agregaron ${amount.toLocaleString("es-MX")} créditos extra.`,
      creditsAdded: amount,
      remainingQuota: credits.remainingQuota,
      extraCredits: credits.extraCredits,
    };
  },
};

export default { typeDefs, definition, resolver };
