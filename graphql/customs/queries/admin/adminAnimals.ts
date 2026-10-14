import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import { ANIMAL_TYPE_OPTIONS } from "../../../../utils/constants/constants";
import {
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  daysAgo,
  insensitive,
  personRef,
  toIso,
  toMxDay,
} from "./shared";

/**
 * Animales de Kadesh Pet en Operaciones (pestaña Kadesh Pet → Animales): lista con filtros y
 * estadísticas, y el detalle con fotos, etapas, comentarios, favoritos y vistas. Solo admin de
 * plataforma. Las acciones (publicar en Facebook, borrar vistas) están en
 * `mutations/admin/animals.ts`; borrar un comentario o favorito usa la API generada.
 */

const typeDefs = `
  type AdminAnimalRow {
    id: ID!
    name: String!
    slug: String
    createdAt: String
    reportedBy: String
    sex: String
    animalType: String
    breed: String
    coverUrl: String
    status: String
    city: String
    state: String
    creator: AdminPersonRef
    creatorIsAdmin: Boolean!
    views: Int!
    views7d: Int!
    favorites: Int!
    comments: Int!
    facebookPostId: String
    facebookPublishedAt: String
  }

  type AdminAnimalsResult {
    total: Int!
    items: [AdminAnimalRow!]!
  }

  type AdminAnimalLog {
    id: ID!
    status: String
    notes: String
    city: String
    state: String
    address: String
    createdAt: String
  }

  type AdminAnimalComment {
    id: ID!
    comment: String!
    createdAt: String
    user: AdminPersonRef
  }

  type AdminAnimalFavorite {
    id: ID!
    createdAt: String
    user: AdminPersonRef
  }

  type AdminAnimalViewDay {
    day: String!
    count: Int!
  }

  type AdminAnimalViews {
    total: Int!
    anonymous: Int!
    signedIn: Int!
    last7d: Int!
    daily: [AdminAnimalViewDay!]!
    recentViewers: [AdminPersonRef!]!
  }

  type AdminAnimalDetail {
    animal: AdminAnimalRow!
    physicalDescription: String
    age: String
    color: String
    size: String
    contactNumber: String
    contactNumber2: String
    sourceUrl: String
    photos: [String!]!
    logs: [AdminAnimalLog!]!
    comments: [AdminAnimalComment!]!
    favoritesList: [AdminAnimalFavorite!]!
    viewStats: AdminAnimalViews!
    facebookPublishedBy: AdminPersonRef
  }
`;

const definition = `
  adminAnimals(
    search: String
    animalTypeId: ID
    reportedBy: String
    creator: String
    facebook: String
    take: Int
    skip: Int
  ): AdminAnimalsResult!
  adminAnimalDetail(id: ID!): AdminAnimalDetail
`;

const ROW_QUERY = `
  id name slug createdAt reportedBy sex
  facebookPostId facebookPublishedAt
  animal_type { name }
  animal_breed { breed }
  user { id name lastName email roles { name } }
  multimedia(orderBy: [{ order: asc }], take: 1) { image { url } }
  logs(orderBy: [{ createdAt: desc }], take: 1) { status city state }
  animal_viewsCount
`;

type AnimalRowRaw = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string | null;
  reportedBy: string | null;
  sex: string | null;
  facebookPostId: string | null;
  facebookPublishedAt: string | null;
  animal_type: { name: string | null } | null;
  animal_breed: { breed: string | null } | null;
  user: {
    id: string;
    name: string | null;
    lastName: string | null;
    email: string | null;
    roles: Array<{ name: string }> | null;
  } | null;
  multimedia: Array<{ image: { url: string } | null }> | null;
  logs: Array<{ status: string | null; city: string | null; state: string | null }> | null;
  animal_viewsCount: number;
};

/** `AnimalType.name` guarda el valor del select ("dog"); Operaciones muestra la etiqueta ("Perro"). */
function animalTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return ANIMAL_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

type Counts = { favorites: Map<string, number>; comments: Map<string, number>; views7d: Map<string, number> };

function animalsWhere(args: {
  search?: string | null;
  animalTypeId?: string | null;
  reportedBy?: string | null;
  creator?: string | null;
  facebook?: string | null;
}) {
  const and: Record<string, unknown>[] = [];
  const q = args.search?.trim();
  if (q) {
    and.push({
      OR: [
        { name: insensitive(q) },
        { slug: insensitive(q) },
        { logs: { some: { city: insensitive(q) } } },
        { user: { OR: [{ name: insensitive(q) }, { email: insensitive(q) }] } },
      ],
    });
  }
  if (args.animalTypeId) and.push({ animal_type: { id: { equals: args.animalTypeId } } });
  if (args.reportedBy) and.push({ reportedBy: { equals: args.reportedBy } });
  const adminRole = { roles: { some: { name: { equals: Role.ADMIN } } } };
  if (args.creator === "admin") and.push({ user: adminRole });
  if (args.creator === "user") and.push({ NOT: [{ user: adminRole }] });
  if (args.facebook === "published") and.push({ facebookPublishedAt: { not: null } });
  if (args.facebook === "pending") and.push({ facebookPublishedAt: { equals: null } });
  return and.length ? { AND: and } : {};
}

async function countsFor(prisma: any, ids: string[]): Promise<Counts> {
  if (ids.length === 0) return { favorites: new Map(), comments: new Map(), views7d: new Map() };
  const [favorites, comments, views7d] = await Promise.all([
    prisma.animalFavorite.groupBy({ by: ["animalId"], where: { animalId: { in: ids } }, _count: { _all: true } }),
    prisma.animalComment.groupBy({ by: ["animalId"], where: { animalId: { in: ids } }, _count: { _all: true } }),
    prisma.animalView.groupBy({
      by: ["animalId"],
      where: { animalId: { in: ids }, createdAt: { gte: daysAgo(7) } },
      _count: { _all: true },
    }),
  ]);
  const toMap = (rows: Array<{ animalId: string | null; _count: { _all: number } }>) =>
    new Map(rows.filter((r) => r.animalId).map((r) => [r.animalId as string, r._count._all]));
  return { favorites: toMap(favorites), comments: toMap(comments), views7d: toMap(views7d) };
}

function toRow(raw: AnimalRowRaw, counts: Counts) {
  const lastLog = raw.logs?.[0] ?? null;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    createdAt: toIso(raw.createdAt),
    reportedBy: raw.reportedBy,
    sex: raw.sex,
    animalType: animalTypeLabel(raw.animal_type?.name),
    breed: raw.animal_breed?.breed || null,
    coverUrl: raw.multimedia?.[0]?.image?.url ?? null,
    status: lastLog?.status ?? null,
    city: lastLog?.city ?? null,
    state: lastLog?.state ?? null,
    creator: personRef(raw.user),
    creatorIsAdmin: Boolean(raw.user?.roles?.some((role) => role.name === Role.ADMIN)),
    views: raw.animal_viewsCount ?? 0,
    views7d: counts.views7d.get(raw.id) ?? 0,
    favorites: counts.favorites.get(raw.id) ?? 0,
    comments: counts.comments.get(raw.id) ?? 0,
    facebookPostId: raw.facebookPostId || null,
    facebookPublishedAt: toIso(raw.facebookPublishedAt),
  };
}

const resolver = {
  adminAnimals: async (
    _root: unknown,
    args: {
      search?: string | null;
      animalTypeId?: string | null;
      reportedBy?: string | null;
      creator?: string | null;
      facebook?: string | null;
      take?: number | null;
      skip?: number | null;
    },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const sudo = context.sudo();
    const where = animalsWhere(args);
    const take = clampInt(args.take, 1, 100, 25);
    const skip = clampInt(args.skip, 0, 1_000_000, 0);

    const [total, rows] = await Promise.all([
      sudo.query.Animal.count({ where }),
      sudo.query.Animal.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        query: ROW_QUERY,
      }) as Promise<AnimalRowRaw[]>,
    ]);
    const counts = await countsFor(adminPrisma(context), rows.map((r) => r.id));
    return { total, items: rows.map((row) => toRow(row, counts)) };
  },

  adminAnimalDetail: async (_root: unknown, { id }: { id: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const sudo = context.sudo();
    const prisma = adminPrisma(context);

    const raw = (await sudo.query.Animal.findOne({
      where: { id },
      query: `${ROW_QUERY}
        physical_description age color size contactNumber contactNumber2 sourceUrl
        facebookPublishedBy { id name lastName email }
        allPhotos: multimedia(orderBy: [{ order: asc }]) { image { url } }
        allLogs: logs(orderBy: [{ createdAt: desc }]) { id status notes city state address createdAt }`,
    })) as
      | (AnimalRowRaw & {
          physical_description: string | null;
          age: string | null;
          color: string | null;
          size: string | null;
          contactNumber: string | null;
          contactNumber2: string | null;
          sourceUrl: string | null;
          facebookPublishedBy: { id: string; name: string; lastName: string | null; email: string | null } | null;
          allPhotos: Array<{ image: { url: string } | null }>;
          allLogs: Array<{
            id: string;
            status: string | null;
            notes: string | null;
            city: string | null;
            state: string | null;
            address: string | null;
            createdAt: string | null;
          }>;
        })
      | null;
    if (!raw) return null;

    const since30 = daysAgo(30);
    const [counts, comments, favorites, anonymous, viewsLast30, recentSigned] = await Promise.all([
      countsFor(prisma, [id]),
      prisma.animalComment.findMany({
        where: { animalId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, comment: true, createdAt: true, user: { select: { id: true, name: true, lastName: true, email: true } } },
      }),
      prisma.animalFavorite.findMany({
        where: { animalId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, createdAt: true, user: { select: { id: true, name: true, lastName: true, email: true } } },
      }),
      prisma.animalView.count({ where: { animalId: id, userId: null } }),
      prisma.animalView.findMany({
        where: { animalId: id, createdAt: { gte: since30 } },
        select: { createdAt: true },
      }),
      prisma.animalView.findMany({
        where: { animalId: id, userId: { not: null } },
        orderBy: { createdAt: "desc" },
        distinct: ["userId"],
        take: 20,
        select: { user: { select: { id: true, name: true, lastName: true, email: true } } },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (const view of viewsLast30 as Array<{ createdAt: Date | null }>) {
      if (!view.createdAt) continue;
      const day = toMxDay(view.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = toMxDay(daysAgo(29 - i));
      return { day, count: byDay.get(day) ?? 0 };
    });

    const total = raw.animal_viewsCount ?? 0;
    return {
      animal: toRow(raw, counts),
      physicalDescription: raw.physical_description,
      age: raw.age,
      color: raw.color,
      size: raw.size,
      contactNumber: raw.contactNumber,
      contactNumber2: raw.contactNumber2,
      sourceUrl: raw.sourceUrl,
      photos: raw.allPhotos.map((photo) => photo.image?.url).filter((url): url is string => Boolean(url)),
      logs: raw.allLogs.map((log) => ({ ...log, createdAt: toIso(log.createdAt) })),
      comments: comments.map((c: any) => ({ id: c.id, comment: c.comment, createdAt: toIso(c.createdAt), user: personRef(c.user) })),
      favoritesList: favorites.map((f: any) => ({ id: f.id, createdAt: toIso(f.createdAt), user: personRef(f.user) })),
      viewStats: {
        total,
        anonymous,
        signedIn: Math.max(0, total - anonymous),
        last7d: counts.views7d.get(id) ?? 0,
        daily,
        recentViewers: recentSigned.map((row: any) => personRef(row.user)).filter(Boolean),
      },
      facebookPublishedBy: personRef(raw.facebookPublishedBy),
    };
  },
};

export default { typeDefs, definition, resolver };
