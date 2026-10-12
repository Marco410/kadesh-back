import { ACTIVITY_EVENT, ACTIVITY_SOURCE } from "../../../../models/ActivityEvent/constants";
import { SUBSCRIPTION_STATUS } from "../../../../models/Saas/SaasCompanySubscription/constants";
import { optionalRead, unwrapPrisma } from "./shared";

/**
 * Primera vez que cada empresa llegó a cada paso de la activación. Lo comparten el embudo de
 * activación y la adquisición (para saber qué canal trae empresas que sí usan y pagan).
 *
 * | Paso | Cuenta desde |
 * |---|---|
 * | Perfil de negocio | Llenó "qué vendes" en su perfil (no guarda fecha) |
 * | Primera extracción | Corrida de extracción exitosa |
 * | Primer contacto | Actividad registrada, WhatsApp enviado (no importado) o lead movido de etapa |
 * | Primera cotización | Cotización creada |
 * | Pagó | Cobro exitoso (plan o recarga) o plan activo con costo (ajustado a mano por Kadesh) |
 */

export type CompanyMilestones = {
  profileDone: boolean;
  firstExtractionAt: Date | null;
  firstContactAt: Date | null;
  firstQuotationAt: Date | null;
  paidAt: Date | null;
};

type MinRow = { companyId: string | null; at: Date | null };

function earliest(map: Map<string, Date>, companyId: string | null, at: Date | null | undefined) {
  if (!companyId || !at) return;
  const date = new Date(at);
  const current = map.get(companyId);
  if (!current || date < current) map.set(companyId, date);
}

function groupMin(rows: Array<{ companyId: string | null; _min: Record<string, Date | null> }>, field: string) {
  return rows.map((row) => ({ companyId: row.companyId, at: row._min[field] ?? null }));
}

export async function loadCompanyMilestones(
  prisma: any,
  companyIds: string[],
): Promise<Map<string, CompanyMilestones>> {
  const result = new Map<string, CompanyMilestones>();
  if (!companyIds.length) return result;
  const ids = { in: companyIds };

  const [profiles, extractions, quotations, whatsapp, statusChanges, activities, payments, paidPlans] =
    await Promise.all([
      prisma.saasCompany.findMany({
        where: { id: ids, onboardingMainOffer: { not: null }, NOT: { onboardingMainOffer: "" } },
        select: { id: true },
      }),
      prisma.techLeadSyncLog.groupBy({
        by: ["companyId"],
        where: { companyId: ids, success: true },
        _min: { createdAt: true },
      }),
      prisma.saasQuotation.groupBy({
        by: ["companyId"],
        where: { companyId: ids },
        _min: { createdAt: true },
      }),
      prisma.techWhatsAppMessage.groupBy({
        by: ["companyId"],
        where: {
          companyId: ids,
          direction: { not: "inbound" },
          OR: [{ source: null }, { source: { not: "imported" } }],
        },
        _min: { createdAt: true },
      }),
      optionalRead(
        () =>
          prisma.activityEvent.groupBy({
            by: ["companyId"],
            where: {
              companyId: ids,
              type: ACTIVITY_EVENT.LEAD_STATUS_CHANGED,
              source: ACTIVITY_SOURCE.WEB,
            },
            _min: { createdAt: true },
          }),
        [],
      ),
      // Las actividades no tienen empresa: cuenta el workspace o, si no hay, quien la creó.
      prisma.$queryRaw`
        SELECT COALESCE(w."company", u."company") AS "companyId", MIN(a."createdAt") AS "at"
        FROM "TechSalesActivity" a
        LEFT JOIN "SaasWorkspace" w ON w."id" = a."workspace"
        LEFT JOIN "User" u ON u."id" = a."createdBy"
        WHERE COALESCE(w."company", u."company") = ANY(${companyIds}::text[])
        GROUP BY 1
      ` as Promise<MinRow[]>,
      prisma.$queryRaw`
        SELECT COALESCE(s."company", u."company") AS "companyId", MIN(p."createdAt") AS "at"
        FROM "SaasPayment" p
        LEFT JOIN "SaasCompanySubscription" s ON s."id" = p."subscription"
        LEFT JOIN "User" u ON u."id" = p."user"
        WHERE p."status" = 'succeeded'
          AND COALESCE(s."company", u."company") = ANY(${companyIds}::text[])
        GROUP BY 1
      ` as Promise<MinRow[]>,
      prisma.saasCompanySubscription.groupBy({
        by: ["companyId"],
        where: { companyId: ids, status: SUBSCRIPTION_STATUS.ACTIVE, planCost: { gt: 0 } },
        _min: { activatedAt: true, createdAt: true },
      }),
    ]);

  for (const result of [profiles, extractions, quotations, whatsapp, activities, payments, paidPlans]) {
    unwrapPrisma(result);
  }

  const firstExtraction = new Map<string, Date>();
  for (const row of groupMin(extractions, "createdAt")) earliest(firstExtraction, row.companyId, row.at);
  const firstQuotation = new Map<string, Date>();
  for (const row of groupMin(quotations, "createdAt")) earliest(firstQuotation, row.companyId, row.at);
  const firstContact = new Map<string, Date>();
  for (const row of groupMin(whatsapp, "createdAt")) earliest(firstContact, row.companyId, row.at);
  for (const row of groupMin(statusChanges, "createdAt")) earliest(firstContact, row.companyId, row.at);
  for (const row of activities) earliest(firstContact, row.companyId, row.at);
  const paid = new Map<string, Date>();
  for (const row of payments) earliest(paid, row.companyId, row.at);
  for (const row of paidPlans as Array<{ companyId: string | null; _min: { activatedAt: Date | null; createdAt: Date | null } }>) {
    earliest(paid, row.companyId, row._min.activatedAt ?? row._min.createdAt);
  }
  const profileDone = new Set((profiles as Array<{ id: string }>).map((row) => row.id));

  for (const companyId of companyIds) {
    result.set(companyId, {
      profileDone: profileDone.has(companyId),
      firstExtractionAt: firstExtraction.get(companyId) ?? null,
      firstContactAt: firstContact.get(companyId) ?? null,
      firstQuotationAt: firstQuotation.get(companyId) ?? null,
      paidAt: paid.get(companyId) ?? null,
    });
  }
  return result;
}
