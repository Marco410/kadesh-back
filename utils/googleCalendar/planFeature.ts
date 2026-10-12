import { KeystoneContext } from "@keystone-6/core/types";
import { companyHasPlanFeature } from "../saas/planFeatures";
import { GOOGLE_CALENDAR_FEATURE_KEY } from "./constants";

/** ¿La suscripción activa de la empresa incluye `calendar_crm`? */
export async function companyHasCalendarFeature(
  context: KeystoneContext,
  companyId: string,
): Promise<boolean> {
  return companyHasPlanFeature(context, companyId, GOOGLE_CALENDAR_FEATURE_KEY);
}

export const CALENDAR_FEATURE_DENIED_MESSAGE =
  "Tu plan actual no incluye la gestión de calendario. Actualiza tu suscripción para conectar Google Calendar.";
