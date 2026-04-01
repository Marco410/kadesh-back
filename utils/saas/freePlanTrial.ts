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

export function getFreePlanTrialInfo(activatedAt: string | null): {
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

  const trialEndDate = new Date(activatedAtDate);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS_FREE_PLAN);
  const trialEnd = toLocalYmd(trialEndDate);
  const today = toLocalYmd(new Date());

  return {
    trialEnd,
    isExpired: trialEnd < today,
  };
}
