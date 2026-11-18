import { mxToday, shiftDay } from "../../../utils/usage/dailyUsageRollup";

/**
 * Paw points ("huellitas"): every rule lives here. Changing a value needs no migration.
 * See README.md for the reasoning behind each rule.
 */

export const PAW_ACTION = {
  REPORT_PUBLISHED: "report_published",
  SIGHTING: "sighting",
  CASE_CLOSED: "case_closed",
  REUNION_HELPED: "reunion_helped",
  ADOPTION_COMPLETED: "adoption_completed",
  EVENT_APPROVED: "event_approved",
  COMMENT: "comment",
  REVIEW: "review",
  FIRST_PET: "first_pet",
  FIRST_HEALTH_RECORD: "first_health_record",
  RESCUE_VERIFIED: "rescue_verified",
  PLACE_VERIFIED: "place_verified",
  REFERRAL: "referral",
  STREAK_BONUS: "streak_bonus",
  ADMIN_ADJUST: "admin_adjust",
} as const;

export type PawAction = (typeof PAW_ACTION)[keyof typeof PAW_ACTION];

export const PAW_ACTION_OPTIONS = Object.values(PAW_ACTION).map((value) => ({ label: value, value }));

/** `spend` is reserved for redemption (phase 2). */
export const PAW_KIND = {
  EARN: "earn",
  REVERSAL: "reversal",
  ADJUST: "adjust",
  SPEND: "spend",
} as const;

export type PawKind = (typeof PAW_KIND)[keyof typeof PAW_KIND];

export const PAW_KIND_OPTIONS = Object.values(PAW_KIND).map((value) => ({ label: value, value }));

type PawRule = {
  points: number;
  /** Awards of this action per person per Mexico City day. `null` = no daily cap. */
  dailyCap: number | null;
  /** Counts toward `GLOBAL_DAILY_CAP`. */
  globalCap: boolean;
  /** Keeps the weekly streak alive. */
  streak: boolean;
};

export const PAW_RULES: Record<Exclude<PawAction, "streak_bonus" | "admin_adjust">, PawRule> = {
  [PAW_ACTION.REPORT_PUBLISHED]: { points: 15, dailyCap: 2, globalCap: true, streak: true },
  [PAW_ACTION.SIGHTING]: { points: 10, dailyCap: 3, globalCap: true, streak: true },
  [PAW_ACTION.CASE_CLOSED]: { points: 10, dailyCap: 2, globalCap: true, streak: true },
  [PAW_ACTION.REUNION_HELPED]: { points: 40, dailyCap: 1, globalCap: false, streak: true },
  [PAW_ACTION.ADOPTION_COMPLETED]: { points: 30, dailyCap: 1, globalCap: false, streak: true },
  [PAW_ACTION.EVENT_APPROVED]: { points: 20, dailyCap: 1, globalCap: false, streak: true },
  [PAW_ACTION.COMMENT]: { points: 3, dailyCap: 3, globalCap: true, streak: true },
  [PAW_ACTION.REVIEW]: { points: 5, dailyCap: 2, globalCap: true, streak: false },
  [PAW_ACTION.FIRST_PET]: { points: 10, dailyCap: null, globalCap: false, streak: false },
  [PAW_ACTION.FIRST_HEALTH_RECORD]: { points: 5, dailyCap: null, globalCap: false, streak: false },
  [PAW_ACTION.RESCUE_VERIFIED]: { points: 50, dailyCap: null, globalCap: false, streak: false },
  [PAW_ACTION.PLACE_VERIFIED]: { points: 30, dailyCap: null, globalCap: false, streak: false },
  [PAW_ACTION.REFERRAL]: { points: 20, dailyCap: 1, globalCap: false, streak: false },
};

/** Actions whose points add up toward the global daily cap. */
export const GLOBAL_CAPPED_ACTIONS: string[] = Object.entries(PAW_RULES)
  .filter(([, rule]) => rule.globalCap)
  .map(([action]) => action);

/** Points per person per day across the capped actions; the last award of the day is trimmed to fit. */
export const GLOBAL_DAILY_CAP = 60;

/** Ledger rows allowed per source key: stops hide/show or close/reopen from growing the ledger. */
export const MAX_ROWS_PER_SOURCE = 6;

/** A case must have been open this long before closing it earns points. */
export const CASE_MIN_AGE_HOURS = 6;

export const COMMENT_MIN_LENGTH = 20;

/** This many reversed sightings within the window switch the sighting award off for the account. */
export const SIGHTING_STRIKE_LIMIT = 3;
export const SIGHTING_STRIKE_DAYS = 30;

export const ADMIN_ADJUST_MAX = 5000;

export const LEADERBOARD_MAX_TAKE = 50;
export const LEADERBOARD_DEFAULT_TAKE = 20;
/** Avatar URLs are signed for 1 h: this cache must stay well below that. */
export const LEADERBOARD_CACHE_MS = 10 * 60 * 1000;

export const MY_PAWS_HISTORY_TAKE = 20;

/** `label` is what people read (level-up notification, profile); `key` is for icons in the fronts. */
export const PAW_LEVELS = [
  { level: 1, key: "puppy", label: "Cachorro", from: 0 },
  { level: 2, key: "explorer", label: "Explorador", from: 30 },
  { level: 3, key: "guardian", label: "Guardián", from: 120 },
  { level: 4, key: "rescuer", label: "Rescatista", from: 350 },
  { level: 5, key: "hero", label: "Héroe", from: 900 },
  { level: 6, key: "legend", label: "Leyenda", from: 2000 },
] as const;

export type PawLevel = {
  level: number;
  key: string;
  label: string;
  /** Lifetime points where this level starts. */
  from: number;
  /** Lifetime points where the next level starts; `null` at the top level. */
  nextAt: number | null;
};

/** The level is derived from lifetime points, never stored: thresholds can change without a backfill. */
export function pawLevelFor(lifetimeEarned: number): PawLevel {
  const points = Math.max(0, Math.floor(lifetimeEarned || 0));
  let index = 0;
  for (let i = 0; i < PAW_LEVELS.length; i += 1) {
    if (points >= PAW_LEVELS[i].from) index = i;
  }
  const current = PAW_LEVELS[index];
  const next = PAW_LEVELS[index + 1];
  return {
    level: current.level,
    key: current.key,
    label: current.label,
    from: current.from,
    nextAt: next ? next.from : null,
  };
}

const STREAK_BONUS_STEP = 5;
const STREAK_BONUS_MAX = 25;

/** Bonus for reaching `weeks` consecutive weeks: nothing the first week, then 5, 10… up to 25. */
export function streakBonusFor(weeks: number): number {
  if (!Number.isFinite(weeks) || weeks < 2) return 0;
  return Math.min(STREAK_BONUS_MAX, STREAK_BONUS_STEP * (Math.floor(weeks) - 1));
}

/** Monday (YYYY-MM-DD) of the Mexico City week that contains `ymd`. */
export function mxWeekStart(ymd: string = mxToday()): string {
  const weekday = (new Date(`${ymd}T12:00:00.000Z`).getUTCDay() + 6) % 7; // Monday = 0
  return shiftDay(ymd, -weekday);
}

/**
 * The streak expires on read: with no qualifying action this week or last week it shows 0.
 * No cron resets it.
 */
export function currentStreakWeeks(
  streakWeeks: number,
  streakWeekStart: string | null | undefined,
  today: string = mxToday(),
): number {
  if (!streakWeekStart || !streakWeeks) return 0;
  const thisWeek = mxWeekStart(today);
  if (streakWeekStart === thisWeek || streakWeekStart === shiftDay(thisWeek, -7)) return streakWeeks;
  return 0;
}
