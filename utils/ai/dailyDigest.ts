import { KeystoneContext } from "@keystone-6/core/types";
import {
  FOLLOW_UP_TASK_STATUS,
  PIPELINE_STATUS,
} from "../../models/Saas/Tech/crm/constants";
import { QUOTATION_STATUS } from "../../models/Saas/Quotation/SaasQuotation.constants";
import { AI_INSIGHT_KIND } from "../../models/Saas/Tech/AiInsight/constants";

export const DIGEST_TIMEZONE = "America/Mexico_City";
export const COLD_LEAD_DAYS = 14;
const SNAPSHOT_TAKE = 8;

export type DigestAction = {
  title: string;
  detail: string;
};

export type DigestInsightRecord = {
  id: string;
  referenceKey?: string | null;
  content?: string | null;
  structuredData?: unknown;
  generatedAt?: string | null;
};

export type DigestInsightPayload = {
  id: string;
  referenceKey: string;
  content: string | null;
  actions: DigestAction[];
  generatedAt: string | null;
};

type SnapshotLine = {
  name: string;
  extra: string;
};

export type DailyDigestSnapshot = {
  today: string;
  quotesWithoutReply: SnapshotLine[];
  uncontactedLeads: SnapshotLine[];
  overdueFollowUps: SnapshotLine[];
  coldLeads: SnapshotLine[];
};

const CLOSED_PIPELINE: string[] = [
  PIPELINE_STATUS.CERRADO_GANADO,
  PIPELINE_STATUS.CERRADO_PERDIDO,
  PIPELINE_STATUS.DESCARTADO,
];

export function todayKey(timeZone = DIGEST_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysAgoKey(days: number, timeZone = DIGEST_TIMEZONE): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function money(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return `$${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function joinExtra(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

export function parseDigestActions(text: string): DigestAction[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const objStart = stripped.indexOf("{");
  const arrStart = stripped.indexOf("[");
  let parsed: unknown = null;

  try {
    if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
      parsed = JSON.parse(stripped.slice(objStart, stripped.lastIndexOf("}") + 1));
    } else if (arrStart !== -1) {
      parsed = JSON.parse(stripped.slice(arrStart, stripped.lastIndexOf("]") + 1));
    } else {
      parsed = JSON.parse(stripped);
    }
  } catch {
    return [];
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { actions?: unknown }).actions)
      ? (parsed as { actions: unknown[] }).actions
      : Array.isArray((parsed as { pasos?: unknown }).pasos)
        ? (parsed as { pasos: unknown[] }).pasos
        : [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? row.titulo ?? "").trim();
      const detail = String(
        row.detail ?? row.detalle ?? row.description ?? "",
      ).trim();
      if (!title || !detail) return null;
      return { title: title.slice(0, 120), detail };
    })
    .filter((item): item is DigestAction => item != null)
    .slice(0, 3);
}

export function actionsFromStructuredData(data: unknown): DigestAction[] {
  if (!data || typeof data !== "object") return [];
  const actions = (data as { actions?: unknown }).actions;
  if (!Array.isArray(actions)) return [];
  return actions
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const detail = String(row.detail ?? "").trim();
      if (!title || !detail) return null;
      return { title, detail };
    })
    .filter((item): item is DigestAction => item != null)
    .slice(0, 3);
}

export function toDigestInsightPayload(
  row: DigestInsightRecord,
): DigestInsightPayload {
  const fromJson = actionsFromStructuredData(row.structuredData);
  const fromText = row.content ? parseDigestActions(row.content) : [];
  return {
    id: row.id,
    referenceKey: row.referenceKey ?? "",
    content: row.content ?? null,
    actions: fromJson.length ? fromJson : fromText,
    generatedAt: row.generatedAt ?? null,
  };
}

export function formatActionsAsContent(actions: DigestAction[]): string {
  return actions
    .map((action, index) => `${index + 1}. ${action.title} — ${action.detail}`)
    .join("\n");
}

const INSIGHT_QUERY =
  "id referenceKey content structuredData generatedAt salesPerson { id }";

export async function findDailyDigestInsight(
  context: KeystoneContext,
  params: { companyId: string; salesPersonId: string | null; today: string },
): Promise<DigestInsightRecord | null> {
  const rows = (await context.sudo().query.TechAiInsight.findMany({
    where: {
      company: { id: { equals: params.companyId } },
      kind: { equals: AI_INSIGHT_KIND.DAILY_DIGEST },
      referenceKey: { equals: params.today },
    },
    take: 20,
    orderBy: [{ generatedAt: "desc" }],
    query: INSIGHT_QUERY,
  })) as Array<DigestInsightRecord & { salesPerson?: { id: string } | null }>;

  const match = rows.find((row) =>
    params.salesPersonId
      ? row.salesPerson?.id === params.salesPersonId
      : !row.salesPerson,
  );
  return match ?? null;
}

export async function saveDailyDigestInsight(
  context: KeystoneContext,
  params: {
    companyId: string;
    salesPersonId: string | null;
    today: string;
    content: string;
    actions: DigestAction[];
    existingId?: string;
  },
): Promise<DigestInsightRecord> {
  const data: Record<string, unknown> = {
    kind: AI_INSIGHT_KIND.DAILY_DIGEST,
    referenceKey: params.today,
    content: params.content,
    structuredData: { actions: params.actions },
    generatedAt: new Date().toISOString(),
    company: { connect: { id: params.companyId } },
  };

  if (params.salesPersonId) {
    data.salesPerson = { connect: { id: params.salesPersonId } };
  }

  if (params.existingId) {
    return (await context.sudo().query.TechAiInsight.updateOne({
      where: { id: params.existingId },
      data,
      query: INSIGHT_QUERY,
    })) as DigestInsightRecord;
  }

  return (await context.sudo().query.TechAiInsight.createOne({
    data,
    query: INSIGHT_QUERY,
  })) as DigestInsightRecord;
}

function formatSnapshotSection(title: string, lines: SnapshotLine[]): string {
  if (lines.length === 0) return `${title}: (ninguno)`;
  return `${title}:\n${lines.map((line) => `- ${line.name}${line.extra ? ` · ${line.extra}` : ""}`).join("\n")}`;
}

export function formatSnapshotPrompt(snapshot: DailyDigestSnapshot): string {
  return [
    `Fecha de hoy (México): ${snapshot.today}`,
    formatSnapshotSection(
      "Cotizaciones enviadas sin respuesta",
      snapshot.quotesWithoutReply,
    ),
    formatSnapshotSection("Leads sin primer contacto", snapshot.uncontactedLeads),
    formatSnapshotSection("Seguimientos vencidos", snapshot.overdueFollowUps),
    formatSnapshotSection(
      `Leads fríos (sin respuesta o sin movimiento ≥ ${COLD_LEAD_DAYS} días)`,
      snapshot.coldLeads,
    ),
  ].join("\n\n");
}

export const DAILY_DIGEST_FEATURE_PROMPT = `Vas a proponer exactamente 3 siguientes pasos de venta para HOY.
Responde SOLO con JSON válido, sin markdown ni texto alrededor, con esta forma:
{"actions":[{"title":"...","detail":"..."}]}
Cada title máximo 80 caracteres. Cada detail 1 o 2 frases concretas (quién, qué hacer, por qué ahora).
Prioriza en este orden: 1) seguimientos vencidos, 2) cotizaciones enviadas sin respuesta, 3) leads sin primer contacto, 4) leads fríos.
Si el pipeline está vacío o es muy corto, sugiere prospección alineada al negocio del contexto.
No inventes nombres de clientes que no aparezcan en el contexto.
Usa el tono de un jefe de ventas claro y accionable.`;

type StatusRow = {
  pipelineStatus?: string | null;
  estimatedValue?: number | null;
  firstContactDate?: string | null;
  businessLead?: {
    businessName?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
};

function statusLine(row: StatusRow): SnapshotLine {
  const name = row.businessLead?.businessName?.trim() || "Lead";
  return {
    name,
    extra: joinExtra([
      row.pipelineStatus,
      money(row.estimatedValue),
      row.businessLead?.city,
      row.businessLead?.phone ? `tel ${row.businessLead.phone}` : null,
      row.firstContactDate ? `contacto ${row.firstContactDate}` : null,
    ]),
  };
}

export async function gatherDailyDigestSnapshot(
  context: KeystoneContext,
  params: { companyId: string; salesPersonId: string | null },
): Promise<DailyDigestSnapshot> {
  const today = todayKey();
  const coldSince = daysAgoKey(COLD_LEAD_DAYS);
  const sudo = context.sudo();
  const sellerStatus = params.salesPersonId
    ? { salesPerson: { id: { equals: params.salesPersonId } } }
    : {};
  const sellerQuote = params.salesPersonId
    ? { assignedSeller: { id: { equals: params.salesPersonId } } }
    : {};
  const sellerFollowUp = params.salesPersonId
    ? { assignedSeller: { id: { equals: params.salesPersonId } } }
    : {};

  const [quotes, uncontacted, overdue, cold] = await Promise.all([
    sudo.query.SaasQuotation.findMany({
      where: {
        company: { id: { equals: params.companyId } },
        status: { equals: QUOTATION_STATUS.SENT },
        ...sellerQuote,
      },
      orderBy: [{ sentAt: "asc" }],
      take: SNAPSHOT_TAKE,
      query:
        "quotationNumber total currency validUntil sentAt lead { businessName phone city }",
    }),
    sudo.query.TechStatusBusinessLead.findMany({
      where: {
        saasCompany: { id: { equals: params.companyId } },
        pipelineStatus: {
          in: [PIPELINE_STATUS.DETECTADO, PIPELINE_STATUS.SELECCIONADO],
        },
        ...sellerStatus,
      },
      orderBy: [{ estimatedValue: "desc" }],
      take: SNAPSHOT_TAKE,
      query:
        "pipelineStatus estimatedValue firstContactDate businessLead { businessName phone city }",
    }),
    sudo.query.TechFollowUpTask.findMany({
      where: {
        status: {
          in: [
            FOLLOW_UP_TASK_STATUS.PENDIENTE,
            FOLLOW_UP_TASK_STATUS.POSPUESTO,
          ],
        },
        scheduledDate: { lt: today },
        businessLead: {
          saasCompany: { some: { id: { equals: params.companyId } } },
        },
        ...sellerFollowUp,
      },
      orderBy: [{ scheduledDate: "asc" }],
      take: SNAPSHOT_TAKE,
      query:
        "scheduledDate priority notes businessLead { businessName phone city }",
    }),
    sudo.query.TechStatusBusinessLead.findMany({
      where: {
        AND: [
          { saasCompany: { id: { equals: params.companyId } } },
          { firstContactDate: { lte: coldSince } },
          { pipelineStatus: { notIn: CLOSED_PIPELINE } },
          ...(params.salesPersonId
            ? [{ salesPerson: { id: { equals: params.salesPersonId } } }]
            : []),
        ],
      },
      orderBy: [{ firstContactDate: "asc" }],
      take: SNAPSHOT_TAKE,
      query:
        "pipelineStatus estimatedValue firstContactDate businessLead { businessName phone city }",
    }),
  ]);

  const quoteRows = quotes as Array<{
    quotationNumber?: string | null;
    total?: number | null;
    validUntil?: string | null;
    sentAt?: string | null;
    lead?: { businessName?: string | null; city?: string | null } | null;
  }>;
  const overdueRows = overdue as Array<{
    scheduledDate?: string | null;
    priority?: string | null;
    notes?: string | null;
    businessLead?: { businessName?: string | null; phone?: string | null } | null;
  }>;

  const uncontactedRows = uncontacted as StatusRow[];
  const coldRows = (cold as StatusRow[]).filter((row) => {
    const status = row.pipelineStatus ?? "";
    if (status === PIPELINE_STATUS.SIN_RESPUESTA) return true;
    return (
      status !== PIPELINE_STATUS.DETECTADO &&
      status !== PIPELINE_STATUS.SELECCIONADO
    );
  });

  const sinRespuesta = (await sudo.query.TechStatusBusinessLead.findMany({
    where: {
      saasCompany: { id: { equals: params.companyId } },
      pipelineStatus: { equals: PIPELINE_STATUS.SIN_RESPUESTA },
      ...sellerStatus,
    },
    orderBy: [{ estimatedValue: "desc" }],
    take: SNAPSHOT_TAKE,
    query:
      "pipelineStatus estimatedValue firstContactDate businessLead { businessName phone city }",
  })) as StatusRow[];

  const coldMerged: StatusRow[] = [];
  const seen = new Set<string>();
  for (const row of [...sinRespuesta, ...coldRows]) {
    const key = `${row.businessLead?.businessName ?? ""}|${row.pipelineStatus ?? ""}|${row.firstContactDate ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    coldMerged.push(row);
    if (coldMerged.length >= SNAPSHOT_TAKE) break;
  }

  return {
    today,
    quotesWithoutReply: quoteRows.map((row) => ({
      name:
        row.lead?.businessName?.trim() ||
        row.quotationNumber ||
        "Cotización",
      extra: joinExtra([
        row.quotationNumber,
        money(row.total),
        row.validUntil ? `vigencia ${row.validUntil}` : null,
        row.sentAt ? `enviada ${String(row.sentAt).slice(0, 10)}` : null,
      ]),
    })),
    uncontactedLeads: uncontactedRows.map(statusLine),
    overdueFollowUps: overdueRows.map((row) => ({
      name: row.businessLead?.businessName?.trim() || "Seguimiento",
      extra: joinExtra([
        row.scheduledDate ? `venció ${row.scheduledDate}` : null,
        row.priority,
        row.businessLead?.phone ? `tel ${row.businessLead.phone}` : null,
        row.notes?.trim()?.slice(0, 80),
      ]),
    })),
    coldLeads: coldMerged.map(statusLine),
  };
}
