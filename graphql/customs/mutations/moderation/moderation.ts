import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../../../models/Notification/constants";
import {
  REPORT_REASON,
  REPORT_REASON_OPTIONS,
  REPORT_STATUS,
  REPORTABLE,
  type ReportableType,
} from "../../../../models/Moderation/constants";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { notify } from "../../../../utils/notifications/notify";

const typeDefs = `
  type Mutation {
    reportContent(entityType: String!, entityId: ID!, reason: String!, details: String): Boolean!
    blockUser(userId: ID!): Boolean!
    unblockUser(userId: ID!): Boolean!
  }
`;

const definition = `
  reportContent(entityType: String!, entityId: ID!, reason: String!, details: String): Boolean!
  blockUser(userId: ID!): Boolean!
  unblockUser(userId: ID!): Boolean!
`;

const TYPES = new Set<string>(Object.values(REPORTABLE));
const REASONS = new Set<string>(Object.values(REPORT_REASON));
const MAX_DETAILS = 500;
const MAX_EXCERPT = 300;

function prismaOf(context: KeystoneContext) {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

function requireUser(context: KeystoneContext): string {
  const userId = getSessionUserId(context.session as any);
  if (!userId) throw new Error("Inicia sesión para continuar.");
  return userId;
}

/** Autor y texto del contenido reportado (para que Operaciones lo vea aunque lo borren). */
async function describe(context: KeystoneContext, type: ReportableType, id: string): Promise<{ authorId: string | null; excerpt: string } | null> {
  const prisma = prismaOf(context);
  if (type === REPORTABLE.ANIMAL_COMMENT) {
    const row = unwrap(await prisma.animalComment.findUnique({ where: { id }, select: { userId: true, comment: true } }));
    return row ? { authorId: row.userId, excerpt: row.comment } : null;
  }
  if (type === REPORTABLE.POST_COMMENT) {
    const row = unwrap(await prisma.postComment.findUnique({ where: { id }, select: { userId: true, comment: true } }));
    return row ? { authorId: row.userId, excerpt: row.comment } : null;
  }
  if (type === REPORTABLE.ANIMAL) {
    const row = unwrap(await prisma.animal.findUnique({ where: { id }, select: { userId: true, name: true, physical_description: true } }));
    return row ? { authorId: row.userId, excerpt: [row.name, row.physical_description].filter(Boolean).join(" — ") } : null;
  }
  const row = unwrap(await prisma.user.findUnique({ where: { id }, select: { id: true, username: true } }));
  return row ? { authorId: row.id, excerpt: row.username ?? "" } : null;
}

const resolver = {
  /**
   * Reporta un comentario, un reporte de animal o a una persona. Avisa a Operaciones en la campana.
   * Repetir el mismo reporte abierto no crea otro.
   */
  reportContent: async (
    _root: unknown,
    { entityType, entityId, reason, details }: { entityType: string; entityId: string; reason: string; details?: string | null },
    context: KeystoneContext,
  ): Promise<boolean> => {
    const reporterId = requireUser(context);
    if (!TYPES.has(entityType)) throw new Error("No se puede reportar este contenido.");
    if (!REASONS.has(reason)) throw new Error("Elige un motivo.");
    const type = entityType as ReportableType;

    const target = await describe(context, type, entityId);
    if (!target) throw new Error("Ese contenido ya no existe.");
    if (target.authorId === reporterId) throw new Error("No puedes reportar tu propio contenido.");

    const prisma = prismaOf(context);
    const existing = unwrap(
      await prisma.contentReport.findFirst({
        where: { reporterId, entityType: type, entityId, status: REPORT_STATUS.OPEN },
        select: { id: true },
      }),
    );
    if (existing) return true;

    const report = unwrap<{ id: string }>(
      await prisma.contentReport.create({
        data: {
          reporterId,
          reportedUserId: target.authorId,
          entityType: type,
          entityId,
          excerpt: target.excerpt.slice(0, MAX_EXCERPT),
          reason,
          details: details?.trim().slice(0, MAX_DETAILS) || "",
          status: REPORT_STATUS.OPEN,
        },
        select: { id: true },
      }),
    );

    const reasonLabel = REPORT_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason;
    void notify(context, {
      audience: "platform_admins",
      product: "pet",
      type: NOTIFICATION_TYPE.CONTENT_REPORTED,
      title: `Contenido reportado: ${reasonLabel}`,
      body: target.excerpt.slice(0, 140),
      entityType: "ContentReport",
      entityId: report.id,
      metadata: { reportedType: type, reportedId: entityId },
    });
    return true;
  },

  /** Deja de ver los comentarios de esa persona. Idempotente. */
  blockUser: async (_root: unknown, { userId }: { userId: string }, context: KeystoneContext): Promise<boolean> => {
    const blockerId = requireUser(context);
    if (userId === blockerId) throw new Error("No puedes bloquearte a ti.");
    const prisma = prismaOf(context);
    const exists = unwrap(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }));
    if (!exists) throw new Error("No se encontró a la persona.");
    const already = unwrap(await prisma.userBlock.findFirst({ where: { blockerId, blockedId: userId }, select: { id: true } }));
    if (!already) unwrap(await prisma.userBlock.create({ data: { blockerId, blockedId: userId } }));
    return true;
  },

  unblockUser: async (_root: unknown, { userId }: { userId: string }, context: KeystoneContext): Promise<boolean> => {
    const blockerId = requireUser(context);
    unwrap(await prismaOf(context).userBlock.deleteMany({ where: { blockerId, blockedId: userId } }));
    return true;
  },
};

export default { typeDefs, definition, resolver };
