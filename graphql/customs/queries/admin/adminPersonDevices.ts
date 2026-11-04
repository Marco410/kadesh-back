import type { KeystoneContext } from "@keystone-6/core/types";
import {
  PERSON_SELECT,
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  daysAgo,
  personRef,
  toIso,
} from "./shared";

/**
 * Dispositivos e IPs de una persona (fase 6.3), para detectar cuentas compartidas o multicuentas.
 * Une sus eventos (`ActivityEvent`) y sus accesos (`UserAuthLog`): cada combinación IP + navegador
 * con cuántas veces, primera y última vez. Además, otras cuentas que usaron esas mismas IPs.
 *
 * Una IP con muchas cuentas (red móvil, empresa, VPN) se marca como "de muchas cuentas" y no se
 * listan sus personas: ahí coincidir no dice nada. Es una señal para revisar, no una prueba.
 */

const typeDefs = `
  type AdminPersonDevice {
    ip: String
    userAgent: String
    count: Int!
    firstSeen: String!
    lastSeen: String!
    """actividad | accesos"""
    sources: [String!]!
  }

  type AdminPersonSharedIp {
    ip: String!
    """Otras cuentas que usaron esta IP en el periodo."""
    accounts: Int!
    """Demasiadas cuentas (red compartida): no se listan."""
    crowded: Boolean!
  }

  type AdminPersonSharedAccount {
    person: AdminPersonRef!
    company: AdminCompanyRef
    """IPs en común con la persona."""
    ips: [String!]!
    count: Int!
    lastSeen: String!
  }

  type AdminPersonDevices {
    devices: [AdminPersonDevice!]!
    sharedIps: [AdminPersonSharedIp!]!
    sharedAccounts: [AdminPersonSharedAccount!]!
  }

  type Query {
    """Dispositivos, IPs y cuentas que comparten IP con una persona (días hacia atrás: 1-395, por defecto 90)."""
    adminPersonDevices(userId: ID!, days: Int): AdminPersonDevices!
  }
`;

const definition = `
  adminPersonDevices(userId: ID!, days: Int): AdminPersonDevices!
`;

/** Más cuentas que esto en una IP = red compartida; coincidir ahí no es señal. */
const CROWDED_IP_ACCOUNTS = 15;
const MAX_IPS = 50;
const MAX_DEVICES = 50;
const MAX_SHARED_ACCOUNTS = 30;

type DeviceGroup = {
  ip: string | null;
  userAgent: string | null;
  _count: { _all: number };
  _min: { createdAt: Date | null };
  _max: { createdAt: Date | null };
};

type Device = {
  ip: string | null;
  userAgent: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  sources: Set<string>;
};

function mergeDevices(target: Map<string, Device>, rows: DeviceGroup[], source: string) {
  for (const row of rows) {
    if (!row._min.createdAt || !row._max.createdAt) continue;
    if (!row.ip && !row.userAgent) continue;
    const key = `${row.ip ?? ""}|${row.userAgent ?? ""}`;
    const current = target.get(key);
    if (!current) {
      target.set(key, {
        ip: row.ip,
        userAgent: row.userAgent,
        count: row._count._all,
        firstSeen: row._min.createdAt,
        lastSeen: row._max.createdAt,
        sources: new Set([source]),
      });
      continue;
    }
    current.count += row._count._all;
    if (row._min.createdAt < current.firstSeen) current.firstSeen = row._min.createdAt;
    if (row._max.createdAt > current.lastSeen) current.lastSeen = row._max.createdAt;
    current.sources.add(source);
  }
}

const resolver = {
  adminPersonDevices: async (
    _root: unknown,
    { userId, days }: { userId: string; days?: number | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const since = daysAgo(clampInt(days, 1, 395, 90));
    const empty = { devices: [], sharedIps: [], sharedAccounts: [] };
    if (!userId) return empty;

    const deviceArgs = {
      by: ["ip", "userAgent"],
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    };
    const [eventDevices, authDevices]: [DeviceGroup[], DeviceGroup[]] = await Promise.all([
      prisma.activityEvent
        ? prisma.activityEvent.groupBy({ ...deviceArgs, where: { actorId: userId, createdAt: { gte: since } } })
        : [],
      prisma.userAuthLog.groupBy({ ...deviceArgs, where: { userId, createdAt: { gte: since } } }),
    ]);

    const merged = new Map<string, Device>();
    mergeDevices(merged, eventDevices, "actividad");
    mergeDevices(merged, authDevices, "accesos");
    const devices = [...merged.values()]
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, MAX_DEVICES);

    const ips = [...new Set(devices.map((device) => device.ip).filter((ip): ip is string => Boolean(ip)))].slice(
      0,
      MAX_IPS,
    );
    if (ips.length === 0) {
      return { ...empty, devices: devices.map(toDeviceOutput) };
    }

    const [eventOthers, authOthers]: [
      Array<{ ip: string; actorId: string | null; _count: { _all: number }; _max: { createdAt: Date | null } }>,
      Array<{ ip: string; userId: string | null; _count: { _all: number }; _max: { createdAt: Date | null } }>,
    ] = await Promise.all([
      prisma.activityEvent
        ? prisma.activityEvent.groupBy({
            by: ["ip", "actorId"],
            where: { ip: { in: ips }, actorId: { not: null }, NOT: { actorId: userId }, createdAt: { gte: since } },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [],
      prisma.userAuthLog.groupBy({
        by: ["ip", "userId"],
        where: { ip: { in: ips }, userId: { not: null }, NOT: { userId }, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    // Por IP: qué otras cuentas la usaron.
    const accountsByIp = new Map<string, Set<string>>();
    // Por cuenta: IPs en común, veces y última vez.
    const byAccount = new Map<string, { ips: Set<string>; count: number; lastSeen: Date }>();
    const add = (ip: string, otherId: string | null, count: number, last: Date | null) => {
      if (!otherId || !last) return;
      const set = accountsByIp.get(ip) ?? new Set<string>();
      set.add(otherId);
      accountsByIp.set(ip, set);
      const current = byAccount.get(otherId) ?? { ips: new Set<string>(), count: 0, lastSeen: last };
      current.ips.add(ip);
      current.count += count;
      if (last > current.lastSeen) current.lastSeen = last;
      byAccount.set(otherId, current);
    };
    for (const row of eventOthers) add(row.ip, row.actorId, row._count._all, row._max.createdAt);
    for (const row of authOthers) add(row.ip, row.userId, row._count._all, row._max.createdAt);

    const crowded = new Set(
      [...accountsByIp.entries()].filter(([, set]) => set.size > CROWDED_IP_ACCOUNTS).map(([ip]) => ip),
    );
    const sharedIps = [...accountsByIp.entries()]
      .map(([ip, set]) => ({ ip, accounts: set.size, crowded: crowded.has(ip) }))
      .sort((a, b) => b.accounts - a.accounts);

    // Solo cuentas que coinciden en al menos una IP que no sea de muchas cuentas.
    const candidates = [...byAccount.entries()]
      .map(([id, data]) => ({ id, ...data, ips: [...data.ips].filter((ip) => !crowded.has(ip)) }))
      .filter((account) => account.ips.length > 0)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, MAX_SHARED_ACCOUNTS);

    const people: Array<{
      id: string;
      name?: string | null;
      lastName?: string | null;
      email?: string | null;
      company: { id: string; name: string } | null;
    }> = candidates.length
      ? await prisma.user.findMany({
          where: { id: { in: candidates.map((account) => account.id) } },
          select: { ...PERSON_SELECT, company: { select: { id: true, name: true } } },
        })
      : [];
    const personById = new Map(people.map((person) => [person.id, person]));

    const sharedAccounts = candidates
      .map((account) => {
        const person = personById.get(account.id);
        if (!person) return null;
        return {
          person: personRef(person),
          company: person.company ?? null,
          ips: account.ips,
          count: account.count,
          lastSeen: toIso(account.lastSeen) as string,
        };
      })
      .filter(Boolean);

    return { devices: devices.map(toDeviceOutput), sharedIps, sharedAccounts };
  },
};

function toDeviceOutput(device: Device) {
  return {
    ip: device.ip,
    userAgent: device.userAgent,
    count: device.count,
    firstSeen: toIso(device.firstSeen) as string,
    lastSeen: toIso(device.lastSeen) as string,
    sources: [...device.sources],
  };
}

export default { typeDefs, definition, resolver };
