import type { KeystoneConfig, KeystoneContext } from "@keystone-6/core/types";

/**
 * Control de acceso por sesión (Operaciones, fase 3).
 *
 * Las sesiones son tokens sellados que duran 30 días y no se guardan en ningún lado, así que
 * "cerrar sesión" desde el servidor no existe por sí solo. Este guardián revisa en cada petición
 * los datos que `withAuth` ya trae de la base (`sessionData`), sin consultas extra:
 * - `sessionVersion`: el token guarda la versión del usuario al iniciar sesión; si Kadesh la sube
 *   (cerrar sesiones, suspender), los tokens viejos dejan de valer.
 * - Suspensión de la persona o de su empresa, y cuentas anonimizadas (ARCO).
 * - "Entrar como": el token del admin trae `impersonation.expiresAt` y deja de valer a la hora.
 */

export const SUSPENDED_MESSAGE =
  "Tu acceso a Kadesh está suspendido. Escríbenos a contacto@kadesh.com.mx para revisarlo.";

export type Impersonation = {
  adminId: string;
  expiresAt: number;
  reason?: string;
};

type GuardedSession = {
  listKey?: string;
  itemId?: string;
  sessionVersion?: number;
  impersonation?: Impersonation;
  data?: {
    sessionVersion?: number | null;
    suspendedAt?: string | null;
    anonymizedAt?: string | null;
    roles?: Array<{ name?: string | null } | null> | null;
    company?: { suspendedAt?: string | null } | null;
  };
};

export type SessionBlockReason = "revoked" | "suspended" | "anonymized" | "impersonation_expired";

function isPlatformAdminData(data: GuardedSession["data"]): boolean {
  return (data?.roles ?? []).some((role) => role?.name === "admin");
}

/** Por qué una sesión ya no vale, o `null` si vale. */
export function sessionBlockReason(session: GuardedSession): SessionBlockReason | null {
  const data = session.data;
  if (!data) return null;
  const tokenVersion = typeof session.sessionVersion === "number" ? session.sessionVersion : 0;
  if ((data.sessionVersion ?? 0) !== tokenVersion) return "revoked";
  if (data.anonymizedAt) return "anonymized";
  if (data.suspendedAt) return "suspended";
  // Nunca dejar fuera al equipo de Kadesh por suspender una empresa.
  if (data.company?.suspendedAt && !isPlatformAdminData(data)) return "suspended";
  if (session.impersonation && Date.now() > session.impersonation.expiresAt) {
    return "impersonation_expired";
  }
  return null;
}

/** Para los logins: la cuenta (o su empresa) está suspendida o anonimizada. */
export async function loginBlockedReason(
  context: KeystoneContext,
  userId: string,
): Promise<"suspended" | "anonymized" | null> {
  try {
    const user = await (context.sudo().prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        suspendedAt: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
        company: { select: { suspendedAt: true } },
      },
    });
    if (!user) return null;
    if (user.anonymizedAt) return "anonymized";
    if (user.suspendedAt) return "suspended";
    if (user.company?.suspendedAt && !isPlatformAdminData(user)) return "suspended";
    return null;
  } catch {
    // Si la consulta falla (p. ej. antes de migrar), el login sigue su curso normal.
    return null;
  }
}

/**
 * Envuelve la estrategia de sesión de `withAuth`:
 * - `start` sella la `sessionVersion` actual del usuario en el token;
 * - `get` descarta sesiones revocadas, suspendidas, anonimizadas o con "entrar como" vencido.
 */
export function withSessionGuards<T extends KeystoneConfig<any>>(config: T): T {
  const inner = config.session;
  if (!inner) return config;
  return {
    ...config,
    session: {
      ...inner,
      async start({ data, context }: { data: any; context: KeystoneContext }) {
        let sessionVersion = data?.sessionVersion;
        if (data?.itemId && typeof sessionVersion !== "number") {
          try {
            const user = await (context.sudo().prisma as any).user.findUnique({
              where: { id: data.itemId },
              select: { sessionVersion: true },
            });
            sessionVersion = user?.sessionVersion ?? 0;
          } catch {
            sessionVersion = 0;
          }
        }
        return inner.start({ data: { ...data, sessionVersion }, context });
      },
      async get({ context }: { context: KeystoneContext }) {
        const session = (await inner.get({ context })) as GuardedSession | undefined;
        if (!session) return undefined;
        return sessionBlockReason(session) ? undefined : session;
      },
    },
  };
}
