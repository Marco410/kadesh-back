import { TRIAL_DAYS_FREE_PLAN } from "../constants/constants";

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdAsLocalDate(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const localDate = new Date(y, m - 1, d);
  if (Number.isNaN(localDate.getTime())) return null;
  return localDate;
}

/**
 * Fin de la prueba del plan gratuito.
 * Si la suscripción trae `currentPeriodEnd` (la crea así el hook de SaasCompany y lo mueve
 * "Extender prueba" o "Ajustar plan"), ese manda. Si no, alta + `TRIAL_DAYS_FREE_PLAN`.
 * Antes solo se usaba la fecha de alta, así que mover el fin del periodo no extendía la prueba.
 */
export function getFreePlanTrialInfo(
  activatedAt: string | null,
  currentPeriodEnd?: string | null,
): {
  trialEnd: string | null;
  isExpired: boolean;
} {
  if (!activatedAt) {
    return { trialEnd: null, isExpired: false };
  }

  const activatedAtDate = parseYmdAsLocalDate(activatedAt);
  if (!activatedAtDate) {
    return { trialEnd: null, isExpired: false };
  }

  const storedEnd = currentPeriodEnd ? parseYmdAsLocalDate(currentPeriodEnd) : null;
  let trialEnd: string;
  if (storedEnd && storedEnd >= activatedAtDate) {
    trialEnd = toLocalYmd(storedEnd);
  } else {
    const trialEndDate = new Date(activatedAtDate);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS_FREE_PLAN);
    trialEnd = toLocalYmd(trialEndDate);
  }
  const today = toLocalYmd(new Date());

  return {
    trialEnd,
    isExpired: trialEnd < today,
  };
}
