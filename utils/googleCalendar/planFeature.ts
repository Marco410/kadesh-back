import { KeystoneContext } from "@keystone-6/core/types";
import { SUBSCRIPTION_STATUS } from "../../models/Saas/SaasCompanySubscription/constants";
import { GOOGLE_CALENDAR_FEATURE_KEY } from "./constants";

type PlanFeature = { key: string; included?: boolean };

/**
 * ¿La suscripción activa de la empresa incluye `calendar_crm`?
 * El snapshot `planFeatures` guarda TODAS las keys con su flag `included`
 * (ver getPlanFeatures), así que no basta con que la key exista.
 */
export async function companyHasCalendarFeature(
  context: KeystoneContext,
  companyId: string,
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
  return (features as PlanFeature[]).some(
    (f) => f.key === GOOGLE_CALENDAR_FEATURE_KEY && f.included !== false,
  );
}

export const CALENDAR_FEATURE_DENIED_MESSAGE =
  "Tu plan actual no incluye la gestión de calendario. Actualiza tu suscripción para conectar Google Calendar.";
