import type { KeystoneContext } from "@keystone-6/core/types";

type StatusItem = {
  id: string;
  pipelineStatus?: string | null;
  saasCompanyId?: string | null;
  businessLeadId?: string | null;
};

/**
 * Guarda el cambio de etapa en `TechLeadStageChange`. Corre en cada escritura de
 * `TechStatusBusinessLead`, también las del servidor (extracciones, propuesta aceptada → ganado),
 * así el historial no depende de quién movió el lead. Nunca rompe la operación: antes de migrar
 * la tabla no existe y el Prisma de Keystone devuelve el error en vez de lanzarlo.
 */
export async function recordStageChange(
  context: KeystoneContext,
  item: StatusItem | undefined,
  previous: string | null,
): Promise<void> {
  if (!item?.pipelineStatus || item.pipelineStatus === previous) return;
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    if (!prisma.techLeadStageChange) return;
    const session = context.session as { itemId?: string } | undefined;
    await prisma.techLeadStageChange.create({
      data: {
        statusId: item.id,
        companyId: item.saasCompanyId ?? null,
        businessLeadId: item.businessLeadId ?? null,
        fromStatus: previous,
        toStatus: item.pipelineStatus,
        changedById: session?.itemId ?? null,
        source: session?.itemId ? "web" : "system",
      },
    });
  } catch {
    // El historial es para medir: si no se pudo guardar, el cambio de etapa sigue adelante.
  }
}
