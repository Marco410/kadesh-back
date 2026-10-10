import { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../models/Saas/Tech/crm/constants";

export type OpportunityLevel = "Alta" | "Media" | "Baja";

/**
 * Asegura el `TechStatusBusinessLead` de un lead en una empresa (con vendedor).
 * Si ya existía lo reactiva como Detectado; si no, lo crea.
 */
export async function ensureLeadStatus(
  context: KeystoneContext,
  params: {
    leadId: string;
    companyId: string;
    userId: string;
    opportunityLevel?: OpportunityLevel;
  },
): Promise<void> {
  const opportunityLevel = params.opportunityLevel ?? "Media";
  const [existing] = await context.sudo().query.TechStatusBusinessLead.findMany({
    where: {
      businessLead: { id: { equals: params.leadId } },
      saasCompany: { id: { equals: params.companyId } },
    },
    take: 1,
    query: "id",
  });
  if (existing) {
    await context.sudo().query.TechStatusBusinessLead.updateOne({
      where: { id: (existing as { id: string }).id },
      data: {
        salesPerson: { connect: { id: params.userId } },
        pipelineStatus: PIPELINE_STATUS.DETECTADO,
        opportunityLevel,
      },
    });
    return;
  }
  await context.sudo().query.TechStatusBusinessLead.createOne({
    data: {
      businessLead: { connect: { id: params.leadId } },
      saasCompany: { connect: { id: params.companyId } },
      salesPerson: { connect: { id: params.userId } },
      pipelineStatus: PIPELINE_STATUS.DETECTADO,
      opportunityLevel,
    },
  });
}

/**
 * Liga un lead que ya existe a otra empresa (N:M, solo `connect`) y confirma en la base
 * que quedó guardado. El hook de tenant de `TechBusinessLead` puede quitar el `connect`;
 * si eso pasa, el lead NO es de la empresa y no se debe cobrar ni crear su status.
 */
export async function linkExistingLeadToCompany(
  context: KeystoneContext,
  params: { leadId: string; companyId: string; sellerId?: string | null },
): Promise<boolean> {
  await context.sudo().query.TechBusinessLead.updateOne({
    where: { id: params.leadId },
    data: {
      saasCompany: { connect: [{ id: params.companyId }] },
      ...(params.sellerId ? { salesPerson: { connect: [{ id: params.sellerId }] } } : {}),
    },
  });
  const linked = (await context.sudo().query.TechBusinessLead.findOne({
    where: { id: params.leadId },
    query: "id saasCompany { id }",
  })) as { saasCompany?: Array<{ id: string }> | null } | null;
  return (linked?.saasCompany ?? []).some((c) => c.id === params.companyId);
}

/**
 * Asigna un lead existente a la empresa: lo liga, lo verifica y crea su status.
 * Devuelve `false` (sin status) si no quedó ligado; quien llama solo cobra los `true`.
 */
export async function assignExistingLeadToCompany(
  context: KeystoneContext,
  params: {
    leadId: string;
    companyId: string;
    userId: string;
    /** Liga también al usuario como vendedor del lead (INEGI). */
    connectSeller?: boolean;
    opportunityLevel?: OpportunityLevel;
    logTag: string;
  },
): Promise<boolean> {
  try {
    const linked = await linkExistingLeadToCompany(context, {
      leadId: params.leadId,
      companyId: params.companyId,
      sellerId: params.connectSeller ? params.userId : null,
    });
    if (!linked) {
      console.warn(`[${params.logTag}] el lead no quedó ligado a la empresa; no se cobra`, {
        leadId: params.leadId,
        companyId: params.companyId,
      });
      return false;
    }
    await ensureLeadStatus(context, {
      leadId: params.leadId,
      companyId: params.companyId,
      userId: params.userId,
      opportunityLevel: params.opportunityLevel,
    });
    return true;
  } catch (err) {
    console.warn(`[${params.logTag}] no se pudo asignar el lead`, {
      leadId: params.leadId,
      companyId: params.companyId,
      err: err instanceof Error ? err.message : err,
    });
    return false;
  }
}
