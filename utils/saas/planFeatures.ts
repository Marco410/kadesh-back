import type { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../models/Saas/SaasCompanySubscription/constants";

/** Llaves de módulos que el back revisa (el catálogo completo vive en el front: `PLAN_FEATURE_KEYS`). */
export const PLAN_FEATURE = {
  CALENDAR_CRM: "calendar_crm",
  ANALYTICS: "analytics",
} as const;

type PlanFeature = { key: string; included?: boolean };

/**
 * ¿La suscripción activa (o en prueba) de la empresa incluye el módulo?
 * El snapshot `planFeatures` guarda TODAS las keys con su flag `included` (ver getPlanFeatures),
 * así que no basta con que la key exista.
 */
export async function companyHasPlanFeature(
  context: KeystoneContext,
  companyId: string,
  key: string,
): Promise<boolean> {
  const [subscription] = await context.sudo().query.SaasCompanySubscription.findMany({
    where: {
      company: { id: { equals: companyId } },
      status: { in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
    },
    orderBy: [{ activatedAt: "desc" }],
    take: 1,
    query: "id planFeatures",
  });
  const features = (subscription as { planFeatures?: unknown } | undefined)?.planFeatures;
  if (!Array.isArray(features)) return false;
  return (features as PlanFeature[]).some((f) => f.key === key && f.included !== false);
}
