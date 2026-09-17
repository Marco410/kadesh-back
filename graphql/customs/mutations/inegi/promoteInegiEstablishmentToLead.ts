import { KeystoneContext } from "@keystone-6/core/types";
import {
  PIPELINE_STATUS,
  LEAD_SOURCE,
} from "../../../../models/Saas/Tech/crm/constants";
import { Role } from "../../../../models/Role/constants";
import {
  denyOtherCompanyMessage,
  getSessionUserId,
  isSignedIn,
  resolveAuthorizedCompanyId,
} from "../../../../utils/access/tenant";
import { getRemainingCredits } from "../../../../utils/helpers/tech/remaining_credits";
import { consumeCompanyCredits } from "../../../../utils/saas/companyCredits";
import { formatEstablishmentAddress } from "../../../../utils/inegi";

const typeDefs = `
  input PromoteInegiEstablishmentToLeadInput {
    establishmentId: ID!
    assignedSellerId: ID
    companyId: ID
  }

  type PromoteInegiEstablishmentToLeadResult {
    success: Boolean!
    message: String!
    businessLeadId: ID
    creditsCharged: Int
  }

  type Mutation {
    promoteInegiEstablishmentToLead(input: PromoteInegiEstablishmentToLeadInput!): PromoteInegiEstablishmentToLeadResult!
  }
`;

const definition = `
  promoteInegiEstablishmentToLead(input: PromoteInegiEstablishmentToLeadInput!): PromoteInegiEstablishmentToLeadResult!
`;

type PromoteInput = {
  establishmentId: string;
  assignedSellerId?: string | null;
  companyId?: string | null;
};

type PromoteResult = {
  success: boolean;
  message: string;
  businessLeadId: string | null;
  creditsCharged: number | null;
};

function fail(message: string): PromoteResult {
  return { success: false, message, businessLeadId: null, creditsCharged: 0 };
}

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
  economicActivity?: {
    id: string;
    name?: string | null;
    scianCode?: string | null;
  } | null;
};

async function ensureStatusForImport(
  context: KeystoneContext,
  leadId: string,
  companyId: string,
  sellerId: string | null,
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

function quotaMessage(
  blockingReason: string | null | undefined,
  remainingQuota: number,
  syncedCount: number,
  leadLimit: number | null,
): string | null {
  if (blockingReason === "no_subscription") {
    return "No tienes una suscripción activa. Contrata o activa una suscripción para promover leads.";
  }
  if (blockingReason === "free_plan_expired") {
    return "Tu plan gratuito ha terminado. Contrata o activa una suscripción para poder obtener más clientes.";
  }
  if (blockingReason === "no_lead_limit") {
    return "La suscripción activa no tiene límite de leads configurado.";
  }
  if (blockingReason === "lead_limit_too_low") {
    return "La suscripción activa no permite sincronizar leads.";
  }
  if (remainingQuota === 0) {
    return `Cuota mensual alcanzada (${syncedCount}/${leadLimit ?? 0} leads). Próximo reinicio el mes siguiente.`;
  }
  return null;
}

const resolver = {
  promoteInegiEstablishmentToLead: async (
    _root: unknown,
    { input }: { input: PromoteInput },
    context: KeystoneContext,
  ): Promise<PromoteResult> => {
    if (!isSignedIn(context.session)) {
      return fail("Debes iniciar sesión para promover un establecimiento");
    }

    const companyId = resolveAuthorizedCompanyId(
      context.session,
      input.companyId,
    );
    if (!companyId) {
      return fail(denyOtherCompanyMessage());
    }

    const establishment = (await context
      .sudo()
      .query.TechInegiEstablishment.findOne({
        where: { id: input.establishmentId },
        query: ESTABLISHMENT_QUERY,
      })) as EstablishmentRow | null;

    if (!establishment) {
      return fail("Establecimiento INEGI no encontrado");
    }

    const credits = await getRemainingCredits(context, companyId);
    const blocked = quotaMessage(
      credits.blockingReason,
      credits.remainingQuota,
      credits.syncedCount,
      credits.leadLimit,
    );
    if (blocked) return fail(blocked);

    const userId = getSessionUserId(context.session);
    let sellerId: string | null = input.assignedSellerId ?? userId;

    if (input.assignedSellerId) {
      const seller = (await context.sudo().query.User.findOne({
        where: { id: input.assignedSellerId },
        query: "id company { id }",
      })) as { id: string; company?: { id: string } | null } | null;
      if (!seller || seller.company?.id !== companyId) {
        return fail("El vendedor no pertenece a tu empresa");
      }
      sellerId = seller.id;
    } else {
      const verifiedSellerIds = await getVerifiedSalesPersonIds(
        context,
        companyId,
      );
      sellerId = verifiedSellerIds[0] ?? userId;
    }

    const [existingLead] = (await context
      .sudo()
      .query.TechBusinessLead.findMany({
        where: {
          sourceEstablishment: { id: { equals: establishment.id } },
        },
        take: 1,
        query: "id saasCompany { id }",
      })) as Array<{ id: string; saasCompany?: Array<{ id: string }> | null }>;

    const alreadyOnCompany = existingLead?.saasCompany?.some(
      (company) => company.id === companyId,
    );

    if (existingLead && alreadyOnCompany) {
      await ensureStatusForImport(
        context,
        existingLead.id,
        companyId,
        sellerId,
      );
      return {
        success: true,
        message: "Este establecimiento ya es un lead de tu empresa",
        businessLeadId: existingLead.id,
        creditsCharged: 0,
      };
    }

    if (existingLead) {
      await context.sudo().query.TechBusinessLead.updateOne({
        where: { id: existingLead.id },
        data: {
          saasCompany: { connect: [{ id: companyId }] },
          ...(sellerId ? { salesPerson: { connect: [{ id: sellerId }] } } : {}),
        },
      });
      await ensureStatusForImport(
        context,
        existingLead.id,
        companyId,
        sellerId,
      );
      const consumeResult = await consumeCompanyCredits(context, {
        companyId,
        amount: 1,
        referenceType: "sync",
        referenceId: existingLead.id,
        notes: "Lead asignado desde catálogo INEGI DENUE",
      });
      if (!consumeResult.success) {
        return fail("No se pudieron descontar créditos para asignar el lead");
      }
      return {
        success: true,
        message: "Lead asignado a tu empresa",
        businessLeadId: existingLead.id,
        creditsCharged: 1,
      };
    }

    const data: Record<string, unknown> = {
      businessName: establishment.name,
      category: establishment.economicActivity?.name || "Negocio",
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
    };

    if (sellerId) {
      data.salesPerson = { connect: [{ id: sellerId }] };
    }

    try {
      const lead = await context.sudo().query.TechBusinessLead.createOne({
        data: data as any,
        query: "id",
      });
      await ensureStatusForImport(context, lead.id, companyId, sellerId);
      const consumeResult = await consumeCompanyCredits(context, {
        companyId,
        amount: 1,
        referenceType: "sync",
        referenceId: lead.id,
        notes: "Lead promovido desde catálogo INEGI DENUE",
      });
      if (!consumeResult.success) {
        return fail("No se pudieron descontar créditos para crear el lead");
      }
      return {
        success: true,
        message: "Lead importado desde INEGI DENUE",
        businessLeadId: lead.id,
        creditsCharged: 1,
      };
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Error creando lead");
    }
  },
};

export default { typeDefs, definition, resolver };
