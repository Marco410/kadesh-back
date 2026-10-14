import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../models/ActivityEvent/constants";
import { QUOTATION_STATUS } from "../../models/Saas/Quotation/SaasQuotation.constants";
import { getSessionUserId } from "../access/tenant";
import { logActivity, type LogActivityInput } from "./logActivity";

/**
 * Registra en `ActivityEvent` lo que las personas cambian por la API de Keystone
 * (mover un lead, asignar vendedor, cambiar roles, ajustar un plan…), con el antes y el después.
 *
 * Solo corre con contexto **no sudo** y con sesión: es decir, cuando una persona usa
 * las mutaciones generadas desde el panel o el Admin UI. Lo que escribe el servidor con
 * `context.sudo()` (extracciones, importaciones, webhooks) se registra con eventos explícitos
 * o ya vive en su propio log; así no se llenan los eventos con miles de altas de una extracción.
 *
 * Nunca rompe la operación: el registro corre después de guardar, sin `await`, y traga errores.
 */

type Item = Record<string, any>;

type HookArgs = {
  operation: "create" | "update" | "delete";
  item?: Item;
  originalItem?: Item;
  inputData?: Record<string, any>;
  context: KeystoneContext;
  listKey: string;
};

type TrackerFn = (args: HookArgs, before: Item | null) => Promise<void>;

type Tracker = {
  create?: TrackerFn;
  update?: TrackerFn;
  delete?: TrackerFn;
  /** Foto de relaciones to-many antes del update (el item de Prisma no las trae). */
  snapshotBefore?: (args: HookArgs) => Promise<Item | null>;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const sudoCache = new WeakMap<object, boolean>();

/** `context.sudo()` usa otro schema: así se distingue una escritura del servidor de una persona. */
export function isSudoContext(context: KeystoneContext): boolean {
  const cached = sudoCache.get(context);
  if (cached !== undefined) return cached;
  let sudo = false;
  try {
    sudo = context.graphql.schema === context.sudo().graphql.schema;
  } catch {
    sudo = false;
  }
  sudoCache.set(context, sudo);
  return sudo;
}

function shouldTrack(context: KeystoneContext): boolean {
  return !isSudoContext(context) && Boolean(getSessionUserId(context.session as any));
}

function prismaOf(context: KeystoneContext): any {
  return context.sudo().prisma;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

function isChanged(before: unknown, after: unknown): boolean {
  return normalize(before) !== normalize(after);
}

function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

/** `{campo: [antes, después]}` de los campos indicados que cambiaron. */
function changesOf(before: Item | undefined, after: Item | undefined, fields: string[]) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const field of fields) {
    const a = before?.[field];
    const b = after?.[field];
    if (isChanged(a, b)) out[field] = [plain(a), plain(b)];
  }
  return out;
}

const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
const FILE_SUFFIX = /_(filename|filesize|extension|width|height|id|mode)$/;

/** Nombres (no valores) de los campos escalares que cambiaron. */
function changedFieldNames(
  before: Item | undefined,
  after: Item | undefined,
  ignore: ReadonlySet<string> = new Set(),
): string[] {
  if (!before || !after) return [];
  const names = new Set<string>();
  for (const key of Object.keys(after)) {
    if (SYSTEM_FIELDS.has(key) || ignore.has(key)) continue;
    if (!isChanged(before[key], after[key])) continue;
    const name = key.replace(FILE_SUFFIX, "");
    if (!ignore.has(name)) names.add(name);
  }
  return [...names];
}

type RelationInput = { connect: string[]; disconnect: string[]; set: string[] | null };

function idsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((entry) => (entry && typeof entry === "object" ? (entry as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === "string");
}

/** Lee `{ connect, disconnect, set }` del input de una relación to-many. */
function relationInput(value: unknown): RelationInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { connect?: unknown; disconnect?: unknown; set?: unknown };
  const result: RelationInput = {
    connect: idsOf(input.connect),
    disconnect: idsOf(input.disconnect),
    set: input.set === undefined ? null : idsOf(input.set),
  };
  if (!result.connect.length && !result.disconnect.length && result.set === null) return null;
  return result;
}

function fullName(person: { name?: string | null; lastName?: string | null } | null | undefined) {
  if (!person) return null;
  const text = [person.name, person.lastName].filter(Boolean).join(" ").trim();
  return text || null;
}

async function leadName(context: KeystoneContext, leadId?: string | null): Promise<string | null> {
  if (!leadId) return null;
  const lead = await prismaOf(context).techBusinessLead.findUnique({
    where: { id: leadId },
    select: { businessName: true },
  });
  return lead?.businessName || null;
}

async function userNames(context: KeystoneContext, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const users: Array<{ id: string; name: string | null; lastName: string | null; email: string | null }> =
    await prismaOf(context).user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, lastName: true, email: true },
    });
  return Object.fromEntries(users.map((u) => [u.id, fullName(u) ?? u.email ?? u.id]));
}

async function workspaceCompanyId(
  context: KeystoneContext,
  workspaceId?: string | null,
): Promise<string | undefined> {
  if (!workspaceId) return undefined;
  const ws = await prismaOf(context).saasWorkspace.findUnique({
    where: { id: workspaceId },
    select: { companyId: true },
  });
  return ws?.companyId ?? undefined;
}

async function columnNames(context: KeystoneContext, ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return {} as Record<string, string>;
  const rows: Array<{ id: string; name: string | null }> = await prismaOf(
    context,
  ).saasWorkspaceCrmStatus.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, r.name ?? "sin nombre"]));
}

function log(context: KeystoneContext, input: LogActivityInput) {
  return logActivity(context, input);
}

function quoted(text: string | null | undefined, fallback: string) {
  return text ? `"${text}"` : fallback;
}

/** Movimiento de una tarjeta entre columnas del tablero de un workspace. */
async function logCardMove(
  args: HookArgs,
  entityType: string,
  label: string,
): Promise<void> {
  const { originalItem: before, item: after, context } = args;
  if (!before || !after || !isChanged(before.statusCrmId, after.statusCrmId)) return;
  const names = await columnNames(context, [before.statusCrmId, after.statusCrmId]);
  const from = before.statusCrmId ? names[before.statusCrmId] ?? null : null;
  const to = after.statusCrmId ? names[after.statusCrmId] ?? null : null;
  await log(context, {
    type: ACTIVITY_EVENT.BOARD_CARD_MOVED,
    companyId: await workspaceCompanyId(context, after.workspaceId),
    workspaceId: after.workspaceId ?? null,
    entityType,
    entityId: after.id,
    summary: `Movió ${label} a la columna ${quoted(to, "sin columna")}`,
    metadata: { from, to, fromId: before.statusCrmId ?? null, toId: after.statusCrmId ?? null },
  });
}

// ── Trackers por list ──────────────────────────────────────────────────────

const LEAD_STATUS_DETAIL_FIELDS = ["estimatedValue", "productOffered", "firstContactDate", "notes"];

const statusBusinessLeadTracker: Tracker = {
  // El panel crea el estatus la primera vez que alguien mueve un lead sin estatus.
  create: async ({ item, context }) => {
    if (!item?.pipelineStatus) return;
    const name = await leadName(context, item.businessLeadId);
    await log(context, {
      type: ACTIVITY_EVENT.LEAD_STATUS_CHANGED,
      companyId: item.saasCompanyId || undefined,
      entityType: "TechBusinessLead",
      entityId: item.businessLeadId ?? item.id,
      summary: `Movió ${name ?? "un lead"} a ${item.pipelineStatus}`,
      metadata: { from: null, to: item.pipelineStatus, statusId: item.id },
    });
  },
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after) return;
    const companyId = after.saasCompanyId || undefined;
    const entityId = after.businessLeadId ?? after.id;
    const name = (await leadName(context, after.businessLeadId)) ?? "un lead";

    if (isChanged(before.pipelineStatus, after.pipelineStatus)) {
      await log(context, {
        type: ACTIVITY_EVENT.LEAD_STATUS_CHANGED,
        companyId,
        entityType: "TechBusinessLead",
        entityId,
        summary: `Movió ${name} de ${before.pipelineStatus ?? "sin etapa"} a ${after.pipelineStatus ?? "sin etapa"}`,
        metadata: { from: before.pipelineStatus ?? null, to: after.pipelineStatus ?? null, statusId: after.id },
      });
    }

    // La asignación ya no vive en el estatus (es de la empresa): se registra desde el lead
    // (`businessLeadTracker`, cambio de `TechBusinessLead.salesPerson`).

    if (isChanged(before.opportunityLevel, after.opportunityLevel)) {
      await log(context, {
        type: ACTIVITY_EVENT.LEAD_OPPORTUNITY_CHANGED,
        companyId,
        entityType: "TechBusinessLead",
        entityId,
        summary: `Cambió la oportunidad de ${name} a ${after.opportunityLevel ?? "sin nivel"}`,
        metadata: { from: before.opportunityLevel ?? null, to: after.opportunityLevel ?? null },
      });
    }

    const details = changesOf(before, after, LEAD_STATUS_DETAIL_FIELDS);
    const fields = Object.keys(details);
    if (fields.length) {
      await log(context, {
        type: ACTIVITY_EVENT.LEAD_UPDATED,
        companyId,
        entityType: "TechBusinessLead",
        entityId,
        summary: `Editó el seguimiento de ${name}`,
        // El valor estimado sí va (sirve para analítica); el resto solo el nombre del campo.
        metadata: {
          fields,
          ...(details.estimatedValue ? { estimatedValue: details.estimatedValue } : {}),
        },
      });
    }
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    const name = await leadName(context, before.businessLeadId);
    await log(context, {
      type: ACTIVITY_EVENT.LEAD_REMOVED,
      companyId: before.saasCompanyId || undefined,
      entityType: "TechBusinessLead",
      entityId: before.businessLeadId ?? before.id,
      summary: `Quitó ${name ?? "un lead"} de su CRM`,
      metadata: { pipelineStatus: before.pipelineStatus ?? null, statusId: before.id },
    });
  },
};

const LEAD_IGNORED_FIELDS = new Set(["websitePromptContent"]);

const businessLeadTracker: Tracker = {
  update: async ({ originalItem: before, item: after, inputData, context }) => {
    if (!before || !after) return;
    const name = after.businessName || "un lead";

    const sellers = relationInput(inputData?.salesPerson);
    if (sellers) {
      const names = await userNames(context, [
        ...sellers.connect,
        ...sellers.disconnect,
        ...(sellers.set ?? []),
      ]);
      const added = (sellers.set ?? sellers.connect).map((id) => names[id] ?? id);
      const removed = sellers.disconnect.map((id) => names[id] ?? id);
      const summary = added.length
        ? `Asignó ${name} a ${added.join(", ")}`
        : `Quitó a ${removed.join(", ")} de ${name}`;
      await log(context, {
        type: ACTIVITY_EVENT.LEAD_ASSIGNED,
        entityType: "TechBusinessLead",
        entityId: after.id,
        summary,
        metadata: {
          connected: sellers.connect,
          disconnected: sellers.disconnect,
          set: sellers.set,
          to: added.length ? added.join(", ") : null,
        },
      });
    }

    const fields = changedFieldNames(before, after, LEAD_IGNORED_FIELDS);
    if (fields.length) {
      await log(context, {
        type: ACTIVITY_EVENT.LEAD_UPDATED,
        entityType: "TechBusinessLead",
        entityId: after.id,
        summary: `Editó los datos de ${name}`,
        metadata: { fields },
      });
    }
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.LEAD_DELETED,
      entityType: "TechBusinessLead",
      entityId: before.id,
      summary: `Borró el lead ${before.businessName || before.id}`,
      metadata: { source: before.source ?? null, category: before.category ?? null },
    });
  },
};

const QUOTATION_EVENT_BY_STATUS: Record<string, string> = {
  [QUOTATION_STATUS.SENT]: ACTIVITY_EVENT.QUOTATION_SENT,
  [QUOTATION_STATUS.ACCEPTED]: ACTIVITY_EVENT.QUOTATION_ACCEPTED,
  [QUOTATION_STATUS.REJECTED]: ACTIVITY_EVENT.QUOTATION_REJECTED,
  [QUOTATION_STATUS.EXPIRED]: ACTIVITY_EVENT.QUOTATION_EXPIRED,
  [QUOTATION_STATUS.DRAFT]: ACTIVITY_EVENT.QUOTATION_REOPENED,
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  [QUOTATION_STATUS.DRAFT]: "borrador",
  [QUOTATION_STATUS.SENT]: "enviada",
  [QUOTATION_STATUS.ACCEPTED]: "aceptada",
  [QUOTATION_STATUS.REJECTED]: "rechazada",
  [QUOTATION_STATUS.EXPIRED]: "expirada",
};

function quotationLabel(item: Item) {
  return item.quotationNumber ? `#${item.quotationNumber}` : "sin número";
}

// La alta ya sale en el feed desde SaasQuotation (createdAt + createdBy); aquí solo cambios.
const quotationTracker: Tracker = {
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after || !isChanged(before.status, after.status)) return;
    const type = QUOTATION_EVENT_BY_STATUS[after.status];
    if (!type) return;
    const lead = await leadName(context, after.leadId);
    await log(context, {
      type,
      companyId: after.companyId || undefined,
      entityType: "SaasQuotation",
      entityId: after.id,
      summary: `Marcó la cotización ${quotationLabel(after)} como ${QUOTATION_STATUS_LABELS[after.status] ?? after.status}${lead ? ` (${lead})` : ""}`,
      metadata: {
        from: before.status ?? null,
        to: after.status,
        total: after.total ?? null,
        currency: after.currency ?? null,
        quotationNumber: after.quotationNumber ?? null,
      },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.QUOTATION_DELETED,
      companyId: before.companyId || undefined,
      entityType: "SaasQuotation",
      entityId: before.id,
      summary: `Borró la cotización ${quotationLabel(before)}`,
      metadata: { status: before.status ?? null, total: before.total ?? null, currency: before.currency ?? null },
    });
  },
};

// La alta ya sale en el feed desde TechProposal; aquí cambios de estatus, tablero y bajas.
const proposalTracker: Tracker = {
  update: async (args) => {
    const { originalItem: before, item: after, context } = args;
    if (!before || !after) return;
    const changes = changesOf(before, after, ["status", "approved", "paid"]);
    if (Object.keys(changes).length) {
      const lead = (await leadName(context, after.businessLeadId)) ?? "un lead";
      const parts: string[] = [];
      if (changes.status) parts.push(`estatus ${after.status}`);
      if (changes.approved) parts.push(after.approved ? "aprobada" : "sin aprobar");
      if (changes.paid) parts.push(after.paid ? "pagada" : "sin pagar");
      await log(context, {
        type: ACTIVITY_EVENT.PROPOSAL_STATUS_CHANGED,
        companyId: await workspaceCompanyId(context, after.workspaceId),
        workspaceId: after.workspaceId ?? null,
        entityType: "TechProposal",
        entityId: after.id,
        summary: `Propuesta para ${lead}: ${parts.join(", ")}`,
        metadata: { changes, amount: after.amount ?? null },
      });
    }
    await logCardMove(args, "TechProposal", "una propuesta");
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    const lead = await leadName(context, before.businessLeadId);
    await log(context, {
      type: ACTIVITY_EVENT.PROPOSAL_DELETED,
      companyId: await workspaceCompanyId(context, before.workspaceId),
      workspaceId: before.workspaceId ?? null,
      entityType: "TechProposal",
      entityId: before.id,
      summary: `Borró una propuesta${lead ? ` de ${lead}` : ""}`,
      metadata: { status: before.status ?? null, amount: before.amount ?? null },
    });
  },
};

const projectTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.PROJECT_CREATED,
      companyId: item.companyId || undefined,
      entityType: "SaasProject",
      entityId: item.id,
      summary: `Creó el proyecto ${quoted(item.name, "sin nombre")}`,
      metadata: { status: item.status ?? null, serviceType: item.serviceType ?? null },
    });
  },
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after || !isChanged(before.status, after.status)) return;
    await log(context, {
      type: ACTIVITY_EVENT.PROJECT_STATUS_CHANGED,
      companyId: after.companyId || undefined,
      entityType: "SaasProject",
      entityId: after.id,
      summary: `Proyecto ${quoted(after.name, "sin nombre")}: ${after.status ?? "sin estatus"}`,
      metadata: { from: before.status ?? null, to: after.status ?? null },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.PROJECT_DELETED,
      companyId: before.companyId || undefined,
      entityType: "SaasProject",
      entityId: before.id,
      summary: `Borró el proyecto ${quoted(before.name, "sin nombre")}`,
      metadata: { status: before.status ?? null },
    });
  },
};

const followUpTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    const lead = await leadName(context, item.businessLeadId);
    await log(context, {
      type: ACTIVITY_EVENT.FOLLOWUP_CREATED,
      companyId: await workspaceCompanyId(context, item.workspaceId),
      workspaceId: item.workspaceId ?? null,
      entityType: "TechFollowUpTask",
      entityId: item.id,
      summary: `Agendó un seguimiento${lead ? ` con ${lead}` : ""}${item.scheduledDate ? ` para el ${plain(item.scheduledDate)}` : ""}`,
      metadata: {
        scheduledDate: plain(item.scheduledDate),
        priority: item.priority ?? null,
        assignedSellerId: item.assignedSellerId ?? null,
      },
    });
  },
  update: async (args) => {
    const { originalItem: before, item: after, context } = args;
    if (!before || !after) return;
    if (isChanged(before.status, after.status)) {
      const lead = await leadName(context, after.businessLeadId);
      await log(context, {
        type: ACTIVITY_EVENT.FOLLOWUP_STATUS_CHANGED,
        companyId: await workspaceCompanyId(context, after.workspaceId),
        workspaceId: after.workspaceId ?? null,
        entityType: "TechFollowUpTask",
        entityId: after.id,
        summary: `Seguimiento${lead ? ` con ${lead}` : ""}: ${after.status ?? "sin estatus"}`,
        metadata: { from: before.status ?? null, to: after.status ?? null },
      });
    }
    await logCardMove(args, "TechFollowUpTask", "un seguimiento");
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.FOLLOWUP_DELETED,
      companyId: await workspaceCompanyId(context, before.workspaceId),
      workspaceId: before.workspaceId ?? null,
      entityType: "TechFollowUpTask",
      entityId: before.id,
      summary: "Borró un seguimiento",
      metadata: { status: before.status ?? null, scheduledDate: plain(before.scheduledDate) },
    });
  },
};

const taskTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.TASK_CREATED,
      companyId: await workspaceCompanyId(context, item.workspaceId),
      workspaceId: item.workspaceId ?? null,
      entityType: "TechTask",
      entityId: item.id,
      summary: `Creó la tarea ${quoted(item.title, "sin título")}`,
      metadata: { priority: item.priority ?? null, responsibleId: item.responsibleId ?? null },
    });
  },
  update: (args) => logCardMove(args, "TechTask", "una tarea"),
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.TASK_DELETED,
      companyId: await workspaceCompanyId(context, before.workspaceId),
      workspaceId: before.workspaceId ?? null,
      entityType: "TechTask",
      entityId: before.id,
      summary: `Borró la tarea ${quoted(before.title, "sin título")}`,
      metadata: null,
    });
  },
};

// La alta ya sale en el feed desde TechSalesActivity.
const salesActivityTracker: Tracker = {
  update: (args) => logCardMove(args, "TechSalesActivity", "una actividad"),
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.ACTIVITY_DELETED,
      companyId: await workspaceCompanyId(context, before.workspaceId),
      workspaceId: before.workspaceId ?? null,
      entityType: "TechSalesActivity",
      entityId: before.id,
      summary: `Borró la actividad ${quoted(before.title, "sin título")}`,
      metadata: { activityType: before.type ?? null },
    });
  },
};

const fileTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.FILE_UPLOADED,
      companyId: item.companyId || undefined,
      entityType: "TechFile",
      entityId: item.id,
      summary: `Subió el archivo ${quoted(item.title, "sin título")}`,
      metadata: { category: item.category ?? null, filesize: item.file_filesize ?? null },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.FILE_DELETED,
      companyId: before.companyId || undefined,
      entityType: "TechFile",
      entityId: before.id,
      summary: `Borró el archivo ${quoted(before.title, "sin título")}`,
      metadata: { category: before.category ?? null },
    });
  },
};

const workspaceTracker: Tracker = {
  snapshotBefore: async ({ inputData, originalItem, context }) => {
    if (!originalItem || !relationInput(inputData?.members)?.set) return null;
    const ws = await prismaOf(context).saasWorkspace.findUnique({
      where: { id: originalItem.id },
      select: { members: { select: { id: true } } },
    });
    return { memberIds: (ws?.members ?? []).map((m: { id: string }) => m.id) };
  },
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.WORKSPACE_CREATED,
      companyId: item.companyId || undefined,
      workspaceId: item.id,
      entityType: "SaasWorkspace",
      entityId: item.id,
      summary: `Creó el espacio ${quoted(item.name, "sin nombre")}`,
      metadata: null,
    });
  },
  update: async ({ item: after, inputData, context }, before) => {
    if (!after) return;
    const members = relationInput(inputData?.members);
    if (!members) return;
    let added = members.connect;
    let removed = members.disconnect;
    if (members.set) {
      const previous: string[] = (before?.memberIds as string[] | undefined) ?? [];
      added = members.set.filter((id) => !previous.includes(id));
      removed = previous.filter((id) => !members.set!.includes(id));
    }
    if (!added.length && !removed.length) return;
    const names = await userNames(context, [...added, ...removed]);
    const parts = [
      added.length ? `agregó a ${added.map((id) => names[id] ?? id).join(", ")}` : null,
      removed.length ? `quitó a ${removed.map((id) => names[id] ?? id).join(", ")}` : null,
    ].filter(Boolean);
    await log(context, {
      type: ACTIVITY_EVENT.WORKSPACE_MEMBERS_CHANGED,
      companyId: after.companyId || undefined,
      workspaceId: after.id,
      entityType: "SaasWorkspace",
      entityId: after.id,
      summary: `Espacio ${quoted(after.name, "sin nombre")}: ${parts.join(" y ")}`,
      metadata: { added, removed },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.WORKSPACE_DELETED,
      companyId: before.companyId || undefined,
      entityType: "SaasWorkspace",
      entityId: before.id,
      summary: `Borró el espacio ${quoted(before.name, "sin nombre")}`,
      metadata: null,
    });
  },
};

/** Campos de User que cambian solos o no dicen nada (onboarding, último acceso). */
const USER_NOISE_FIELDS = new Set([
  "onboardingState",
  "lastLoginAt",
  "smsRegistrationId",
  "password",
]);

function permissionList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const userTracker: Tracker = {
  snapshotBefore: async ({ inputData, originalItem, context }) => {
    if (!originalItem || inputData?.roles === undefined) return null;
    const user = await prismaOf(context).user.findUnique({
      where: { id: originalItem.id },
      select: { roles: { select: { name: true } } },
    });
    return { roles: (user?.roles ?? []).map((r: { name: string }) => r.name).sort() };
  },
  // Alta hecha por otra persona (admin de empresa o de Kadesh). El registro propio va en UserAuthLog.
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.TEAM_USER_CREATED,
      companyId: item.companyId || undefined,
      entityType: "User",
      entityId: item.id,
      summary: `Dio de alta a ${fullName(item) ?? item.email ?? "una persona"}`,
      metadata: { userId: item.id, email: item.email ?? null },
    });
  },
  update: async ({ originalItem: before, item: after, inputData, context }, snapshot) => {
    if (!before || !after) return;
    const companyId = after.companyId || before.companyId || undefined;
    const target = fullName(after) ?? after.email ?? "una persona";
    const selfEdit = getSessionUserId(context.session as any) === after.id;

    if (inputData?.roles !== undefined) {
      const user = await prismaOf(context).user.findUnique({
        where: { id: after.id },
        select: { roles: { select: { name: true } } },
      });
      const to: string[] = (user?.roles ?? []).map((r: { name: string }) => r.name).sort();
      const from: string[] = (snapshot?.roles as string[] | undefined) ?? [];
      if (from.join("|") !== to.join("|")) {
        await log(context, {
          type: ACTIVITY_EVENT.TEAM_ROLES_CHANGED,
          companyId,
          entityType: "User",
          entityId: after.id,
          summary: `Cambió los roles de ${target}: ${to.join(", ") || "sin roles"}`,
          metadata: {
            from,
            to,
            added: to.filter((r) => !from.includes(r)),
            removed: from.filter((r) => !to.includes(r)),
          },
        });
      }
    }

    if (isChanged(before.permissions, after.permissions)) {
      const from = permissionList(before.permissions);
      const to = permissionList(after.permissions);
      await log(context, {
        type: ACTIVITY_EVENT.TEAM_PERMISSIONS_CHANGED,
        companyId,
        entityType: "User",
        entityId: after.id,
        summary: `Cambió los permisos de ${target}`,
        metadata: {
          added: to.filter((p) => !from.includes(p)),
          removed: from.filter((p) => !to.includes(p)),
          legacy: after.permissions == null,
        },
      });
    }

    if (isChanged(before.companyId, after.companyId)) {
      await log(context, {
        type: ACTIVITY_EVENT.TEAM_COMPANY_CHANGED,
        companyId,
        entityType: "User",
        entityId: after.id,
        summary: after.companyId ? `Cambió de empresa a ${target}` : `Sacó a ${target} de su empresa`,
        metadata: { from: before.companyId ?? null, to: after.companyId ?? null },
      });
    }

    // Los cambios de perfil propios son ruido; los que hace otra persona sí se auditan.
    if (selfEdit) return;
    const fields = changedFieldNames(
      before,
      after,
      new Set([...USER_NOISE_FIELDS, "permissions", "companyId"]),
    );
    const passwordChanged = isChanged(before.password, after.password);
    if (!fields.length && !passwordChanged) return;
    await log(context, {
      type: ACTIVITY_EVENT.TEAM_USER_UPDATED,
      companyId,
      entityType: "User",
      entityId: after.id,
      summary: `Editó el perfil de ${target}${passwordChanged ? " (incluida la contraseña)" : ""}`,
      metadata: { fields: passwordChanged ? [...fields, "password"] : fields },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.TEAM_USER_DELETED,
      companyId: before.companyId || undefined,
      entityType: "User",
      entityId: before.id,
      summary: `Borró la cuenta de ${fullName(before) ?? before.email ?? "una persona"}`,
      metadata: { email: before.email ?? null },
    });
  },
};

const COMPANY_NOISE_FIELDS = new Set(["whatsappLastWebhookAt", "purchasedBonusCredits"]);

const companyTracker: Tracker = {
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after) return;
    const fields = changedFieldNames(before, after, COMPANY_NOISE_FIELDS);
    if (!fields.length) return;
    await log(context, {
      type: ACTIVITY_EVENT.COMPANY_UPDATED,
      companyId: after.id,
      entityType: "SaasCompany",
      entityId: after.id,
      summary: `Editó los datos de la empresa ${after.name ?? ""}`.trim(),
      metadata: { fields },
    });
  },
};

const SUBSCRIPTION_FIELDS = [
  "status",
  "planName",
  "planCost",
  "planFrequency",
  "planLeadLimit",
  "newCreditsAdded",
  "activatedAt",
  "currentPeriodEnd",
  "stripeSubscriptionId",
];

function featureKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => (f && typeof f === "object" ? (f as { key?: unknown }).key : null))
    .filter((k): k is string => typeof k === "string")
    .sort();
}

function featureChanges(before: unknown, after: unknown) {
  const from = featureKeys(before);
  const to = featureKeys(after);
  const added = to.filter((k) => !from.includes(k));
  const removed = from.filter((k) => !to.includes(k));
  return added.length || removed.length ? { added, removed } : null;
}

// Por API solo el admin de plataforma escribe suscripciones (Fase 0): todo esto es "Ajustar plan".
const subscriptionTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_SUBSCRIPTION_CHANGED,
      companyId: item.companyId || undefined,
      entityType: "SaasCompanySubscription",
      entityId: item.id,
      summary: `Creó la suscripción ${item.planName || "sin plan"} (${item.status ?? "sin estatus"})`,
      metadata: { created: true, status: item.status ?? null, planName: item.planName ?? null },
    });
  },
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after) return;
    const changes = changesOf(before, after, SUBSCRIPTION_FIELDS);
    const features = featureChanges(before.planFeatures, after.planFeatures);
    if (!Object.keys(changes).length && !features) return;
    const parts = Object.keys(changes);
    if (features) parts.push("módulos");
    const plan = after.planName ? ` ${after.planName}` : "";
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_SUBSCRIPTION_CHANGED,
      companyId: after.companyId || undefined,
      entityType: "SaasCompanySubscription",
      entityId: after.id,
      summary: `Ajustó el plan${plan}: ${parts.join(", ")}`,
      metadata: { changes, ...(features ? { features } : {}) },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_SUBSCRIPTION_CHANGED,
      companyId: before.companyId || undefined,
      entityType: "SaasCompanySubscription",
      entityId: before.id,
      summary: `Borró la suscripción ${before.planName || before.id}`,
      metadata: { deleted: true, status: before.status ?? null },
    });
  },
};

const PLAN_FIELDS = [
  "name",
  "cost",
  "costOld",
  "frequency",
  "currency",
  "leadLimit",
  "active",
  "bestSeller",
  "stripePriceId",
  "referralUpfrontCommissionPct",
  "referralRecurringCommissionPct",
];

const planTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_PLAN_CATALOG_CHANGED,
      companyId: null,
      entityType: "SaasPlan",
      entityId: item.id,
      summary: `Creó el plan ${item.name ?? item.id}`,
      metadata: { created: true, cost: item.cost ?? null, leadLimit: item.leadLimit ?? null },
    });
  },
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after) return;
    const changes = changesOf(before, after, PLAN_FIELDS);
    const features = featureChanges(before.planFeatures, after.planFeatures);
    if (!Object.keys(changes).length && !features) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_PLAN_CATALOG_CHANGED,
      companyId: null,
      entityType: "SaasPlan",
      entityId: after.id,
      summary: `Editó el plan ${after.name ?? after.id}`,
      metadata: { changes, ...(features ? { features } : {}) },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_PLAN_CATALOG_CHANGED,
      companyId: null,
      entityType: "SaasPlan",
      entityId: before.id,
      summary: `Borró el plan ${before.name ?? before.id}`,
      metadata: { deleted: true },
    });
  },
};

const CREDIT_PACKAGE_FIELDS = [
  "name",
  "slug",
  "cost",
  "costOld",
  "currency",
  "creditsToAdd",
  "active",
  "bestSeller",
  "stripePriceId",
];

const creditPackageTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_CREDIT_PACKAGE_CHANGED,
      companyId: null,
      entityType: "SaasCredit",
      entityId: item.id,
      summary: `Creó el paquete de créditos ${item.name ?? item.id}`,
      metadata: { created: true, cost: item.cost ?? null, creditsToAdd: item.creditsToAdd ?? null },
    });
  },
  update: async ({ originalItem: before, item: after, context }) => {
    if (!before || !after) return;
    const changes = changesOf(before, after, CREDIT_PACKAGE_FIELDS);
    if (!Object.keys(changes).length) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_CREDIT_PACKAGE_CHANGED,
      companyId: null,
      entityType: "SaasCredit",
      entityId: after.id,
      summary: `Editó el paquete de créditos ${after.name ?? after.id}`,
      metadata: { changes },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_CREDIT_PACKAGE_CHANGED,
      companyId: null,
      entityType: "SaasCredit",
      entityId: before.id,
      summary: `Borró el paquete de créditos ${before.name ?? before.id}`,
      metadata: { deleted: true },
    });
  },
};

// El texto de la nota no se copia al evento: basta con saber que existe y quién la dejó.
const companyNoteTracker: Tracker = {
  create: async ({ item, context }) => {
    if (!item) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_NOTE_ADDED,
      companyId: item.companyId || null,
      entityType: "SaasCompanyNote",
      entityId: item.id,
      summary: `Agregó una nota interna${item.pinned ? " (fijada)" : ""}`,
      metadata: { pinned: Boolean(item.pinned) },
    });
  },
  delete: async ({ originalItem: before, context }) => {
    if (!before) return;
    await log(context, {
      type: ACTIVITY_EVENT.ADMIN_NOTE_DELETED,
      companyId: before.companyId || null,
      entityType: "SaasCompanyNote",
      entityId: before.id,
      summary: "Borró una nota interna",
      metadata: null,
    });
  },
};

/** List → qué se registra. Para agregar una list, agrega su tracker aquí. */
export const ACTIVITY_TRACKERS: Record<string, Tracker> = {
  TechStatusBusinessLead: statusBusinessLeadTracker,
  TechBusinessLead: businessLeadTracker,
  SaasQuotation: quotationTracker,
  TechProposal: proposalTracker,
  SaasProject: projectTracker,
  TechFollowUpTask: followUpTracker,
  TechTask: taskTracker,
  TechSalesActivity: salesActivityTracker,
  TechFile: fileTracker,
  SaasWorkspace: workspaceTracker,
  User: userTracker,
  SaasCompany: companyTracker,
  SaasCompanySubscription: subscriptionTracker,
  SaasPlan: planTracker,
  SaasCredit: creditPackageTracker,
  SaasCompanyNote: companyNoteTracker,
};

// ── Composición con los hooks que ya tiene cada list ──────────────────────

type AnyHook = (args: any) => any;
type HookMap = { create?: AnyHook; update?: AnyHook; delete?: AnyHook };

function asMap(hook: unknown): HookMap {
  if (!hook) return {};
  if (typeof hook === "function") {
    const fn = hook as AnyHook;
    return { create: fn, update: fn, delete: fn };
  }
  return hook as HookMap;
}

/** Fotos previas por operación: Keystone pasa el mismo `inputData` a before y after. */
const snapshots = new WeakMap<object, Item | null>();

function runTracker(fn: TrackerFn | undefined, args: HookArgs) {
  if (!fn || !shouldTrack(args.context)) return;
  const before = args.inputData ? snapshots.get(args.inputData) ?? null : null;
  void Promise.resolve()
    .then(() => fn(args, before))
    .catch((error) => {
      console.warn(
        `[activity] hook ${args.listKey}.${args.operation}:`,
        error instanceof Error ? error.message : error,
      );
    });
}

function composeHooks(existing: Record<string, unknown> | undefined, tracker: Tracker) {
  const hooks: Record<string, unknown> = { ...(existing ?? {}) };
  const after = asMap(existing?.afterOperation);

  hooks.afterOperation = {
    create: async (args: HookArgs) => {
      await after.create?.(args);
      runTracker(tracker.create, args);
    },
    update: async (args: HookArgs) => {
      await after.update?.(args);
      runTracker(tracker.update, args);
    },
    delete: async (args: HookArgs) => {
      await after.delete?.(args);
      runTracker(tracker.delete, args);
    },
  };

  if (tracker.snapshotBefore) {
    const before = asMap(existing?.beforeOperation);
    const snapshot = tracker.snapshotBefore;
    hooks.beforeOperation = {
      ...before,
      update: async (args: HookArgs) => {
        await before.update?.(args);
        if (!args.inputData || !shouldTrack(args.context)) return;
        try {
          snapshots.set(args.inputData, await snapshot(args));
        } catch {
          // Sin foto previa el evento sale igual, solo sin el "antes".
        }
      },
    };
  }

  return hooks;
}

/** Envuelve las lists de `models/schema.ts` con el registro de actividad. */
export function withActivityHooks<T extends Record<string, any>>(lists: T): T {
  const out: Record<string, any> = { ...lists };
  for (const [listKey, tracker] of Object.entries(ACTIVITY_TRACKERS)) {
    const config = lists[listKey];
    if (!config) continue;
    out[listKey] = { ...config, hooks: composeHooks(config.hooks, tracker) };
  }
  return out as T;
}
