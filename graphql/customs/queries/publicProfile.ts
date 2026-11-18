import type { KeystoneContext } from "@keystone-6/core/types";
import { RESCUE_ORG_STATUS } from "../../../models/Pet/RescueOrganization/constants";
import { automationUserId } from "../../../utils/notifications/animalReportAlerts";
import { getAnimalCoverUrls } from "../../../utils/pet/animalCovers";
import { animalDisplayName } from "../../../utils/pet/animalName";
import { pawsEnabled } from "../../../utils/pet/paws";
import { pawLevelFor, currentStreakWeeks } from "../../../models/Pet/Paws/constants";
import {
  PUBLIC_USER_QUERY,
  getPublicUserCards,
  isPublicPerson,
  publicDisplayName,
} from "../../../utils/pet/publicProfile";
import { allTimeRankOf } from "./pawLeaderboard";

/**
 * Public side of a person in Kadesh Pet. All public, no session needed.
 *
 * - `animalAuthor(animalId)`: who published a report (name with initial, photo, level, profile
 *   link). `null` for the automation account, suspended or anonymized people, and people with the
 *   public profile off.
 * - `publicUserProfile(username)`: the `/u/<username>` page. `null` when it does not exist or the
 *   person turned it off. Phone and email only when the person chose to show them.
 * - `publicUserReports(username, take, skip)`: more reports for that page.
 *
 * Cost of a profile: about 10 queries (user, paw account, reports + count + covers, events + count,
 * rescue spaces, clinics). The landing caches the page 5 min per username; nothing here polls.
 */
const PROFILE_REPORTS_TAKE = 12;
const PROFILE_EVENTS_TAKE = 6;
const REPORTS_MAX_TAKE = 24;

const typeDefs = `
  type PublicUserCard {
    "For the /u/<username> link; null when the person turned their public profile off."
    username: String
    "First name and initial of the last name («Marco C.»)."
    displayName: String!
    avatarUrl: String
    "Null while paws are switched off."
    level: PawLevelInfo
  }

  type PublicUserReport {
    id: ID!
    slug: String
    displayName: String!
    "Latest log status: lost | found | in_adoption | in_family | adopted | …"
    status: String
    outcome: String
    city: String
    coverUrl: String
    createdAt: String
  }

  type PublicUserEvent {
    id: ID!
    slug: String
    title: String!
    city: String
    state: String
    firstStartsAt: String
    lastEndsAt: String
  }

  type PublicUserRescueOrg {
    id: ID!
    slug: String
    name: String!
    city: String
    state: String
    logoUrl: String
    "admin | coordinator | volunteer | foster"
    role: String
  }

  type PublicUserClinic {
    id: ID!
    slug: String
    name: String!
    municipality: String
    state: String
  }

  type PublicUserProfile {
    username: String!
    displayName: String!
    avatarUrl: String
    bio: String
    "Only when the person chose to show it."
    phone: String
    "Only when the person chose to show it."
    email: String
    memberSince: String
    level: PawLevelInfo
    lifetimeEarned: Int!
    streakWeeks: Int!
    "All-time ranking position when in the top 50 and not hidden."
    rank: Int
    reportsCount: Int!
    eventsCount: Int!
    reports: [PublicUserReport!]!
    events: [PublicUserEvent!]!
    rescueOrgs: [PublicUserRescueOrg!]!
    clinics: [PublicUserClinic!]!
  }
`;

const definition = `
  animalAuthor(animalId: ID!): PublicUserCard
  publicUserProfile(username: String!): PublicUserProfile
  publicUserReports(username: String!, take: Int, skip: Int): [PublicUserReport!]!
`;

type ProfileUser = {
  id: string;
  username: string;
  name?: string | null;
  lastName?: string | null;
  publicProfileEnabled?: boolean | null;
  suspendedAt?: string | null;
  anonymizedAt?: string | null;
  profileImage?: { url?: string | null } | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  showPhoneOnProfile?: boolean | null;
  showEmailOnProfile?: boolean | null;
  createdAt?: string | null;
};

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The person behind `/u/<username>`, or null when it must not be shown. */
async function loadProfileUser(context: KeystoneContext, username: string): Promise<ProfileUser | null> {
  const clean = username.trim().toLowerCase();
  if (!clean || clean.length > 120) return null;
  const [row] = (await context.sudo().query.User.findMany({
    where: { username: { equals: clean } },
    query: `${PUBLIC_USER_QUERY} bio phone email showPhoneOnProfile showEmailOnProfile createdAt`,
    take: 1,
  })) as ProfileUser[];
  if (!isPublicPerson(row) || row.publicProfileEnabled === false) return null;
  if (row.id === automationUserId()) return null;
  return row;
}

type ReportRow = {
  id: string;
  slug: string | null;
  name: string | null;
  sex: string | null;
  color: string | null;
  typeName: string | null;
  outcome: string | null;
  createdAt: Date | null;
  status: string | null;
  city: string | null;
};

/** Reports of a person with their latest status and city, in one query; covers in one more. */
async function loadReports(context: KeystoneContext, userId: string, take: number, skip: number) {
  const rows = unwrap(
    await prismaOf(context).$queryRaw`
      SELECT a.id, a.slug, a.name, a.sex, a.color, t.name AS "typeName", a.outcome, a."createdAt",
             last.status, last.city
      FROM "Animal" a
      LEFT JOIN "AnimalType" t ON t.id = a."animal_type"
      LEFT JOIN LATERAL (
        SELECT l.status, l.city FROM "AnimalLog" l
        WHERE l."animal" = a.id
        ORDER BY l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
        LIMIT 1
      ) last ON true
      WHERE a."user" = ${userId} AND a."duplicateOf" IS NULL AND last.status IS NOT NULL
      ORDER BY a."createdAt" DESC NULLS LAST
      LIMIT ${take}::int OFFSET ${skip}::int
    `,
  ) as ReportRow[];
  const covers = await getAnimalCoverUrls(rows.map((row) => row.id), context);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: animalDisplayName({ name: row.name, typeName: row.typeName, sex: row.sex, color: row.color }),
    status: row.status,
    outcome: row.outcome,
    city: row.city || null,
    coverUrl: covers.get(row.id) ?? null,
    createdAt: iso(row.createdAt),
  }));
}

async function countReports(context: KeystoneContext, userId: string): Promise<number> {
  const rows = unwrap(
    await prismaOf(context).$queryRaw`
      SELECT count(*)::int AS n FROM "Animal" a
      WHERE a."user" = ${userId} AND a."duplicateOf" IS NULL
        AND EXISTS (SELECT 1 FROM "AnimalLog" l WHERE l."animal" = a.id)
    `,
  ) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

async function loadEvents(context: KeystoneContext, userId: string) {
  const prisma = prismaOf(context);
  const where = { userId, status: "approved" };
  const [rows, count] = await Promise.all([
    prisma.petEvent.findMany({
      where,
      orderBy: [{ firstStartsAt: "desc" }],
      take: PROFILE_EVENTS_TAKE,
      select: { id: true, slug: true, title: true, city: true, state: true, firstStartsAt: true, lastEndsAt: true },
    }),
    prisma.petEvent.count({ where }),
  ]);
  const events = unwrap(rows) as Array<{
    id: string;
    slug: string | null;
    title: string;
    city: string;
    state: string;
    firstStartsAt: Date | null;
    lastEndsAt: Date | null;
  }>;
  return {
    count: unwrap(count) as number,
    events: events.map((event) => ({
      ...event,
      city: event.city || null,
      state: event.state || null,
      firstStartsAt: iso(event.firstStartsAt),
      lastEndsAt: iso(event.lastEndsAt),
    })),
  };
}

async function loadRescueOrgs(context: KeystoneContext, userId: string) {
  const members = (await context.sudo().query.RescueOrganizationMember.findMany({
    where: {
      user: { id: { equals: userId } },
      organization: { status: { equals: RESCUE_ORG_STATUS.VERIFIED } },
    },
    query: "role organization { id slug name city state logo { url } }",
    take: 20,
  })) as Array<{
    role?: string | null;
    organization?: {
      id: string;
      slug?: string | null;
      name: string;
      city?: string | null;
      state?: string | null;
      logo?: { url?: string | null } | null;
    } | null;
  }>;
  return members
    .filter((member) => member.organization)
    .map((member) => ({
      id: member.organization!.id,
      slug: member.organization!.slug ?? null,
      name: member.organization!.name,
      city: member.organization!.city || null,
      state: member.organization!.state || null,
      logoUrl: member.organization!.logo?.url ?? null,
      role: member.role ?? null,
    }));
}

async function loadClinics(context: KeystoneContext, userId: string) {
  const rows = unwrap(
    await prismaOf(context).petPlace.findMany({
      where: { userId, verified: true },
      orderBy: [{ name: "asc" }],
      take: 20,
      select: { id: true, slug: true, name: true, municipality: true, state: true },
    }),
  ) as Array<{ id: string; slug: string | null; name: string; municipality: string; state: string }>;
  return rows.map((row) => ({ ...row, municipality: row.municipality || null, state: row.state || null }));
}

const resolver = {
  animalAuthor: async (_root: unknown, { animalId }: { animalId: string }, context: KeystoneContext) => {
    try {
      const animal = unwrap(
        await prismaOf(context).animal.findUnique({ where: { id: animalId }, select: { userId: true } }),
      ) as { userId: string | null } | null;
      const userId = animal?.userId;
      if (!userId || userId === automationUserId()) return null;
      const card = (await getPublicUserCards(context, [userId])).get(userId);
      // With the public profile off, the report goes without an author (as before this feature).
      if (!card?.username) return null;
      return card;
    } catch (error) {
      console.error("[animalAuthor]", error);
      return null;
    }
  },

  publicUserProfile: async (_root: unknown, { username }: { username: string }, context: KeystoneContext) => {
    const user = await loadProfileUser(context, username);
    if (!user) return null;

    const prisma = prismaOf(context);
    const [account, reports, reportsCount, events, rescueOrgs, clinics] = await Promise.all([
      pawsEnabled()
        ? prisma.pawAccount.findFirst({
            where: { userId: user.id },
            select: { lifetimeEarned: true, streakWeeks: true, streakWeekStart: true, rankingHidden: true },
          })
        : Promise.resolve(null),
      loadReports(context, user.id, PROFILE_REPORTS_TAKE, 0),
      countReports(context, user.id),
      loadEvents(context, user.id),
      loadRescueOrgs(context, user.id),
      loadClinics(context, user.id),
    ]);
    const paws = unwrap(account) as {
      lifetimeEarned: number;
      streakWeeks: number;
      streakWeekStart: string;
      rankingHidden: boolean;
    } | null;

    return {
      username: user.username,
      displayName: publicDisplayName(user.name, user.lastName),
      avatarUrl: user.profileImage?.url ?? null,
      bio: user.bio?.trim() || null,
      phone: user.showPhoneOnProfile ? user.phone?.trim() || null : null,
      email: user.showEmailOnProfile ? user.email?.trim() || null : null,
      memberSince: iso(user.createdAt),
      level: pawsEnabled() ? pawLevelFor(paws?.lifetimeEarned ?? 0) : null,
      lifetimeEarned: paws?.lifetimeEarned ?? 0,
      streakWeeks: paws ? currentStreakWeeks(paws.streakWeeks, paws.streakWeekStart) : 0,
      rank: paws && !paws.rankingHidden ? await allTimeRankOf(context, user.id) : null,
      reportsCount,
      eventsCount: events.count,
      reports,
      events: events.events,
      rescueOrgs,
      clinics,
    };
  },

  publicUserReports: async (
    _root: unknown,
    args: { username: string; take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    const user = await loadProfileUser(context, args.username);
    if (!user) return [];
    const take = Math.min(Math.max(1, Math.floor(Number(args.take ?? PROFILE_REPORTS_TAKE)) || PROFILE_REPORTS_TAKE), REPORTS_MAX_TAKE);
    const skip = Math.max(0, Math.floor(Number(args.skip ?? 0)) || 0);
    return loadReports(context, user.id, take, skip);
  },
};

export default { typeDefs, definition, resolver };
