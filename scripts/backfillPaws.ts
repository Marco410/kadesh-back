/**
 * Paw points ("huellitas") for what people already did before the feature existed. It can be run
 * again: it only adds what is missing, and at the end it recomputes every balance from the ledger,
 * so it also repairs an account whose balance drifted.
 *
 * Same rules as the live engine (`utils/pet/paws.ts`, `models/Pet/Paws/constants.ts`):
 * - one award per source key, daily caps per action and the global daily cap, by Mexico City day
 *   of the date it happened;
 * - staff, the automation account, and suspended, anonymized or test accounts earn nothing;
 * - no points for acting on your own report or place.
 * Differences, on purpose:
 * - each row keeps the date it happened (`createdAt`), so this month's ranking is not the whole
 *   history; `balanceAfter` stays empty;
 * - streak weeks are computed from the real weeks with help, but no streak bonus is paid backwards;
 * - past adoptions are left out: there is no clean record of who adopted.
 *
 * Run it after the migration and before switching `PAWS_ENABLED` on; then once more right after,
 * to cover what happened in between.
 *
 *   pnpm paws:backfill              # only counts and shows what it would add
 *   pnpm paws:backfill --apply      # saves it
 *   pnpm paws:backfill:prod --apply # against production (config/.env.prod)
 */
import "../env";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  CASE_MIN_AGE_HOURS,
  COMMENT_MIN_LENGTH,
  GLOBAL_DAILY_CAP,
  PAW_ACTION,
  PAW_KIND,
  PAW_RULES,
  mxWeekStart,
} from "../models/Pet/Paws/constants";
import { Role } from "../models/Role/constants";
import { mxToday, shiftDay } from "../utils/usage/dailyUsageRollup";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

type RuleAction = keyof typeof PAW_RULES;

type SourceRow = { ref: string; uid: string; at: Date | null };

type Candidate = {
  sourceKey: string;
  userId: string;
  action: RuleAction;
  at: Date;
  referenceType: string;
  referenceId: string;
};

type NewRow = Candidate & { amount: number };

const INSERT_CHUNK = 500;
const STREAK_ACTIONS: string[] = Object.entries(PAW_RULES)
  .filter(([, rule]) => rule.streak)
  .map(([action]) => action);

function newId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

async function loadEligibleUsers(): Promise<Map<string, string | null>> {
  const automationId = process.env.PET_AUTOMATION_USER_ID?.trim() || "";
  const rows = await prisma.$queryRaw<Array<{ id: string; referredBy: string | null }>>`
    SELECT u.id, u."referredBy"
    FROM "User" u
    WHERE u."suspendedAt" IS NULL AND u."anonymizedAt" IS NULL AND u."userTest" = false
      AND u.id <> ${automationId}
      AND NOT EXISTS (
        SELECT 1 FROM "_Role_users" ru JOIN "Role" r ON r.id = ru."A"
        WHERE ru."B" = u.id AND r.name = ${Role.ADMIN}
      )
  `;
  return new Map(rows.map((row) => [row.id, row.referredBy]));
}

/** Every historical action that could earn, before caps. One query per kind of action. */
async function loadCandidates(): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const add = (
    rows: SourceRow[],
    action: RuleAction,
    referenceType: string,
    sourceKey: (row: SourceRow) => string,
  ) => {
    for (const row of rows) {
      if (!row.uid || !row.ref || !row.at) continue;
      candidates.push({
        sourceKey: sourceKey(row),
        userId: row.uid,
        action,
        at: new Date(row.at),
        referenceType,
        referenceId: row.ref,
      });
    }
  };

  // Published = the report has at least one log; the date is its first log.
  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT a.id AS ref, a."user" AS uid, first_log.at
      FROM "Animal" a
      JOIN LATERAL (
        SELECT min(l."createdAt") AS at FROM "AnimalLog" l WHERE l."animal" = a.id
      ) first_log ON first_log.at IS NOT NULL
      WHERE a."user" IS NOT NULL AND a."duplicateOf" IS NULL
    `,
    PAW_ACTION.REPORT_PUBLISHED,
    "Animal",
    (row) => `report:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT a.id AS ref, a."user" AS uid, a."closedAt" AS at
      FROM "Animal" a
      WHERE a."user" IS NOT NULL AND a.outcome IS NOT NULL AND a."duplicateOf" IS NULL
        AND a."closedAt" IS NOT NULL AND a."createdAt" IS NOT NULL
        AND a."closedAt" - a."createdAt" >= make_interval(hours => ${CASE_MIN_AGE_HOURS}::int)
    `,
    PAW_ACTION.CASE_CLOSED,
    "Animal",
    (row) => `case:${row.ref}`,
  );

  // The first visible sighting per person and animal, on someone else's report.
  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (s."user", s."animal") s."animal" AS ref, s."user" AS uid, s."createdAt" AS at
      FROM "AnimalSighting" s
      JOIN "Animal" a ON a.id = s."animal"
      WHERE s."user" IS NOT NULL AND s.hidden = false AND s."user" IS DISTINCT FROM a."user"
      ORDER BY s."user", s."animal", s."createdAt"
    `,
    PAW_ACTION.SIGHTING,
    "Animal",
    (row) => `sighting:${row.uid}:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (c."user", c."animal") c."animal" AS ref, c."user" AS uid, c."createdAt" AS at
      FROM "AnimalComment" c
      JOIN "Animal" a ON a.id = c."animal"
      WHERE c."user" IS NOT NULL AND c."user" IS DISTINCT FROM a."user"
        AND length(btrim(c.comment)) >= ${COMMENT_MIN_LENGTH}::int
      ORDER BY c."user", c."animal", c."createdAt"
    `,
    PAW_ACTION.COMMENT,
    "Animal",
    (row) => `comment:${row.uid}:${row.ref}`,
  );

  // Reviews written by people (not the ones imported from Google), never of their own place.
  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (r."user", r."pet_place") r."pet_place" AS ref, r."user" AS uid, r."createdAt" AS at
      FROM "Review" r
      JOIN "PetPlace" p ON p.id = r."pet_place"
      WHERE r."user" IS NOT NULL AND r."google_user" = '' AND r."user" IS DISTINCT FROM p."user"
      ORDER BY r."user", r."pet_place", r."createdAt"
    `,
    PAW_ACTION.REVIEW,
    "PetPlace",
    (row) => `review:${row.uid}:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT e.id AS ref, e."user" AS uid, e."approvedAt" AS at
      FROM "PetEvent" e
      WHERE e."user" IS NOT NULL AND e.status = 'approved' AND e."approvedAt" IS NOT NULL
    `,
    PAW_ACTION.EVENT_APPROVED,
    "PetEvent",
    (row) => `event:${row.ref}`,
  );

  // Approved claim: whoever had the report before it passed to its owner.
  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (c."animal") c."animal" AS ref, c."previousUser" AS uid, c."resolvedAt" AS at
      FROM "AnimalClaim" c
      WHERE c.status = 'approved' AND c."animal" IS NOT NULL AND c."previousUser" IS NOT NULL
        AND c."previousUser" IS DISTINCT FROM c."claimant"
      ORDER BY c."animal", c."resolvedAt"
    `,
    PAW_ACTION.REUNION_HELPED,
    "Animal",
    (row) => `reunion:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT o.id AS ref, o."createdBy" AS uid, COALESCE(o."verifiedAt", o."createdAt") AS at
      FROM "RescueOrganization" o
      WHERE o.status = 'verified' AND o."createdBy" IS NOT NULL
    `,
    PAW_ACTION.RESCUE_VERIFIED,
    "RescueOrganization",
    (row) => `rescue:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT p.id AS ref, p."user" AS uid, COALESCE(p."verifiedAt", p."createdAt") AS at
      FROM "PetPlace" p
      WHERE p.verified = true AND p."user" IS NOT NULL
    `,
    PAW_ACTION.PLACE_VERIFIED,
    "PetPlace",
    (row) => `place:${row.ref}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (o."user") o."pet" AS ref, o."user" AS uid, o."createdAt" AS at
      FROM "PetOwner" o
      WHERE o."user" IS NOT NULL AND o."pet" IS NOT NULL AND o.role = 'principal'
      ORDER BY o."user", o."createdAt"
    `,
    PAW_ACTION.FIRST_PET,
    "Pet",
    (row) => `first_pet:${row.uid}`,
  );

  add(
    await prisma.$queryRaw<SourceRow[]>`
      SELECT DISTINCT ON (h."createdBy") h.id AS ref, h."createdBy" AS uid, h."createdAt" AS at
      FROM "PetHealthRecord" h
      WHERE h."createdBy" IS NOT NULL
      ORDER BY h."createdBy", h."createdAt"
    `,
    PAW_ACTION.FIRST_HEALTH_RECORD,
    "PetHealthRecord",
    (row) => `first_health_record:${row.uid}`,
  );

  return candidates;
}

/** Caps per person and Mexico City day, seeded with what the ledger already has. */
class DailyCaps {
  private counts = new Map<string, number>();
  private cappedSums = new Map<string, number>();

  record(userId: string, action: string, amount: number, at: Date) {
    const day = mxToday(at);
    const actionKey = `${userId}|${day}|${action}`;
    this.counts.set(actionKey, (this.counts.get(actionKey) ?? 0) + 1);
    if (PAW_RULES[action as RuleAction]?.globalCap) {
      const dayKey = `${userId}|${day}`;
      this.cappedSums.set(dayKey, (this.cappedSums.get(dayKey) ?? 0) + amount);
    }
  }

  /** Points this action may still earn that day; 0 when a cap was reached. */
  allowed(userId: string, action: RuleAction, at: Date): number {
    const rule = PAW_RULES[action];
    const day = mxToday(at);
    if (rule.dailyCap !== null && (this.counts.get(`${userId}|${day}|${action}`) ?? 0) >= rule.dailyCap) return 0;
    if (!rule.globalCap) return rule.points;
    return Math.max(0, Math.min(rule.points, GLOBAL_DAILY_CAP - (this.cappedSums.get(`${userId}|${day}`) ?? 0)));
  }
}

/** Current run of consecutive weeks (ending at the latest one) and the best run ever. */
function streakOf(weeks: Set<string>): { streakWeeks: number; bestStreakWeeks: number; streakWeekStart: string } {
  const sorted = [...weeks].sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const week of sorted) {
    run = previous && shiftDay(previous, 7) === week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return { streakWeeks: run, bestStreakWeeks: best, streakWeekStart: previous };
}

async function main() {
  let existing: Array<{ sourceKey: string; user: string | null; action: string; kind: string; amount: number; createdAt: Date | null }>;
  try {
    existing = await prisma.$queryRaw`
      SELECT t."sourceKey", t."user", t.action, t.kind, t.amount, t."createdAt" FROM "PawTransaction" t
    `;
  } catch (error) {
    console.error("No se pudo leer PawTransaction. ¿Ya corriste la migración (yarn migrate)?");
    throw error;
  }

  const users = await loadEligibleUsers();
  const candidates = (await loadCandidates())
    .filter((candidate) => users.has(candidate.userId))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const taken = new Set(existing.map((row) => row.sourceKey));
  const caps = new DailyCaps();
  for (const row of existing) {
    if (row.kind === PAW_KIND.EARN && row.user && row.createdAt) {
      caps.record(row.user, row.action, row.amount, new Date(row.createdAt));
    }
  }

  const rows: NewRow[] = [];
  const skipped = { alreadyThere: 0, capped: 0 };
  const firstAwardAt = new Map<string, Date>();
  for (const candidate of candidates) {
    if (taken.has(candidate.sourceKey)) {
      skipped.alreadyThere += 1;
      continue;
    }
    const amount = caps.allowed(candidate.userId, candidate.action, candidate.at);
    if (amount <= 0) {
      skipped.capped += 1;
      continue;
    }
    taken.add(candidate.sourceKey);
    caps.record(candidate.userId, candidate.action, amount, candidate.at);
    rows.push({ ...candidate, amount });
    if (!firstAwardAt.has(candidate.userId)) firstAwardAt.set(candidate.userId, candidate.at);
  }

  // Whoever invited someone earns once, on the date that person first helped.
  const referrals = [...firstAwardAt.entries()]
    .map(([userId, at]) => ({ userId, at, referrerId: users.get(userId) ?? null }))
    .filter((entry) => entry.referrerId && users.has(entry.referrerId))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const entry of referrals) {
    const sourceKey = `referral:${entry.userId}`;
    const referrerId = entry.referrerId as string;
    if (taken.has(sourceKey)) continue;
    const amount = caps.allowed(referrerId, PAW_ACTION.REFERRAL, entry.at);
    if (amount <= 0) {
      skipped.capped += 1;
      continue;
    }
    taken.add(sourceKey);
    caps.record(referrerId, PAW_ACTION.REFERRAL, amount, entry.at);
    rows.push({
      sourceKey,
      userId: referrerId,
      action: PAW_ACTION.REFERRAL,
      at: entry.at,
      referenceType: "User",
      referenceId: entry.userId,
      amount,
    });
  }

  const byAction = new Map<string, { rows: number; points: number }>();
  const byUser = new Map<string, number>();
  for (const row of rows) {
    const stat = byAction.get(row.action) ?? { rows: 0, points: 0 };
    stat.rows += 1;
    stat.points += row.amount;
    byAction.set(row.action, stat);
    byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + row.amount);
  }

  console.log(`Movimientos que ya existen: ${existing.length}`);
  console.log(`Por agregar: ${rows.length} movimientos para ${byUser.size} personas`);
  console.log(`Sin premio: ${skipped.alreadyThere} ya estaban, ${skipped.capped} por tope diario`);
  for (const [action, stat] of [...byAction.entries()].sort((a, b) => b[1].points - a[1].points)) {
    console.log(`  ${action.padEnd(22)} ${String(stat.rows).padStart(6)} movimientos  ${String(stat.points).padStart(7)} huellitas`);
  }
  const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length > 0) console.log("Las 10 personas que más recibirían (id: huellitas):");
  for (const [userId, points] of top) console.log(`  ${userId}: ${points}`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }

  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    await (prisma as any).pawTransaction.createMany({
      data: rows.slice(start, start + INSERT_CHUNK).map((row) => ({
        id: newId(),
        userId: row.userId,
        action: row.action,
        kind: PAW_KIND.EARN,
        amount: row.amount,
        key: `${row.sourceKey}#0`,
        sourceKey: row.sourceKey,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        metadata: { backfill: true },
        createdAt: row.at,
      })),
      skipDuplicates: true,
    });
  }

  // An account for everyone in the ledger, then balances straight from the ledger.
  const createdAccounts = await prisma.$executeRaw`
    INSERT INTO "PawAccount"
      ("id", "user", "balance", "lifetimeEarned", "streakWeeks", "bestStreakWeeks", "streakWeekStart", "rankingHidden", "updatedAt")
    SELECT 'c' || substr(md5(random()::text || t."user"), 1, 24), t."user", 0, 0, 0, 0, '', false, CURRENT_TIMESTAMP
    FROM (SELECT DISTINCT "user" FROM "PawTransaction" WHERE "user" IS NOT NULL) t
    ON CONFLICT ("user") DO NOTHING
  `;
  const fixedBalances = await prisma.$executeRaw`
    UPDATE "PawAccount" a SET
      "balance" = s.balance,
      "lifetimeEarned" = s.lifetime,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (
      SELECT t."user", sum(t.amount)::int AS balance,
        GREATEST(0, COALESCE(sum(t.amount) FILTER (WHERE t.kind <> ${PAW_KIND.SPEND}), 0))::int AS lifetime
      FROM "PawTransaction" t
      WHERE t."user" IS NOT NULL
      GROUP BY t."user"
    ) s
    WHERE a."user" = s."user" AND (a."balance" <> s.balance OR a."lifetimeEarned" <> s.lifetime)
  `;

  // Streaks of the people who received rows now, from every week they helped (old rows and new).
  const touched = [...byUser.keys()];
  let streaksSet = 0;
  if (touched.length > 0) {
    const helped = await prisma.$queryRaw<Array<{ user: string; createdAt: Date }>>`
      SELECT t."user", t."createdAt" FROM "PawTransaction" t
      WHERE t.kind = ${PAW_KIND.EARN} AND t.action = ANY(${STREAK_ACTIONS}::text[])
        AND t."user" = ANY(${touched}::text[]) AND t."createdAt" IS NOT NULL
    `;
    const weeksByUser = new Map<string, Set<string>>();
    for (const row of helped) {
      const weeks = weeksByUser.get(row.user) ?? new Set<string>();
      weeks.add(mxWeekStart(mxToday(new Date(row.createdAt))));
      weeksByUser.set(row.user, weeks);
    }
    for (const [userId, weeks] of weeksByUser) {
      const streak = streakOf(weeks);
      streaksSet += await prisma.$executeRaw`
        UPDATE "PawAccount" SET
          "streakWeeks" = ${streak.streakWeeks}::int,
          "bestStreakWeeks" = GREATEST("bestStreakWeeks", ${streak.bestStreakWeeks}::int),
          "streakWeekStart" = ${streak.streakWeekStart}
        WHERE "user" = ${userId}
          AND ("streakWeeks" <> ${streak.streakWeeks}::int OR "streakWeekStart" <> ${streak.streakWeekStart}
            OR "bestStreakWeeks" < ${streak.bestStreakWeeks}::int)
      `;
    }
  }

  console.log(
    `Listo: ${rows.length} movimientos, ${createdAccounts} cuentas nuevas, ${fixedBalances} saldos recalculados, ${streaksSet} rachas puestas.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
