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

/** Por qué no valió el token que mandó la petición. `expired`: vencido, inválido o de alguien que ya no existe. */
export type SessionEndReason = SessionBlockReason | "expired";

/** Lo que el front le muestra a la persona en el login (va en `extensions.session.message`). */
export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  expired: "Tu sesión expiró. Vuelve a iniciar sesión.",
  revoked: "Tu sesión expiró. Vuelve a iniciar sesión.",
  suspended: SUSPENDED_MESSAGE,
  anonymized: "Esta cuenta ya no está disponible.",
  impersonation_expired: "Terminó el tiempo para ver el panel como esta persona.",
};

/** Petición → motivo por el que se descartó su token. Se lee al armar la respuesta. */
const endedSessions = new WeakMap<object, SessionEndReason>();

/** La petición traía token: `Authorization: Bearer …` o la cookie de sesión (igual que `statelessSessions`). */
function hasSessionToken(req: any): boolean {
  const authorization = req?.headers?.authorization;
  if (typeof authorization === "string" && authorization.replace("Bearer ", "").trim()) return true;
  const cookie = req?.headers?.cookie;
  return typeof cookie === "string" && /(?:^|;\s*)keystonejs-session=[^;\s]+/.test(cookie);
}

export function sessionEndReason(req: unknown): SessionEndReason | null {
  return req && typeof req === "object" ? endedSessions.get(req) ?? null : null;
}

function isPlatformAdminData(data: GuardedSession["data"]): boolean {
  return (data?.roles ?? []).some((role) => role?.name === "admin");
}

/**
 * Por qué una sesión ya no vale, o `null` si vale. Primero lo más específico: suspender también
 * cierra las sesiones (sube la versión), y la persona debe ver el aviso de suspensión, no el de
 * "tu sesión expiró".
 */
export function sessionBlockReason(session: GuardedSession): SessionBlockReason | null {
  const data = session.data;
  if (!data) return null;
  if (data.anonymizedAt) return "anonymized";
  if (data.suspendedAt) return "suspended";
  // Nunca dejar fuera al equipo de Kadesh por suspender una empresa.
  if (data.company?.suspendedAt && !isPlatformAdminData(data)) return "suspended";
  const tokenVersion = typeof session.sessionVersion === "number" ? session.sessionVersion : 0;
  if ((data.sessionVersion ?? 0) !== tokenVersion) return "revoked";
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
        const reason: SessionEndReason | null = session
          ? sessionBlockReason(session)
          : hasSessionToken(context.req)
            ? "expired"
            : null;
        // Se anota para avisarle al front en la respuesta (`sessionEndedNoticePlugin`).
        if (reason && context.req) endedSessions.set(context.req, reason);
        return session && !reason ? session : undefined;
      },
    },
  };
}

/**
 * Plugin de Apollo: si la petición traía un token que ya no vale, la respuesta lo dice en
 * `extensions.session: { status, message }`. Sin esto la persona se quedaba en un panel vacío
 * (sin sesión todo responde vacío o "acceso denegado") en vez de volver al login.
 */
export const sessionEndedNoticePlugin = {
  async requestDidStart() {
    return {
      async willSendResponse(requestContext: {
        contextValue?: { req?: unknown };
        response: {
          body:
            | { kind: "single"; singleResult: { extensions?: Record<string, unknown> } }
            | { kind: "incremental" };
        };
      }) {
        const reason = sessionEndReason(requestContext.contextValue?.req);
        const body = requestContext.response.body;
        if (!reason || body.kind !== "single") return;
        body.singleResult.extensions = {
          ...body.singleResult.extensions,
          session: { status: reason, message: SESSION_END_MESSAGES[reason] },
        };
      },
    };
  },
};
