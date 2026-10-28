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
  /** `name` es el nombre real del negocio (no un número de cotización ni un genérico). */
  named: boolean;
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

type FallbackCandidate = DigestAction & {
  /** Negocio al que se refiere, para no repetir a quien el modelo ya mencionó. */
  name: string | null;
};

function shortName(name: string): string {
  return name.length > 50 ? `${name.slice(0, 49).trim()}…` : name;
}

function overdueAction(line: SnapshotLine): FallbackCandidate {
  return {
    name: line.named ? line.name : null,
    title: line.named
      ? `Retoma el seguimiento con ${shortName(line.name)}`
      : "Retoma un seguimiento vencido",
    detail:
      "Ya esperaba noticias tuyas. Un WhatsApp corto confirmando el siguiente paso desbloquea más que un mensaje largo.",
  };
}

function quoteAction(line: SnapshotLine): FallbackCandidate {
  // Sin negocio, `name` es el folio de la cotización (o el genérico "Cotización").
  const title = line.named
    ? `Empuja la cotización de ${shortName(line.name)}`
    : line.name !== "Cotización"
      ? `Empuja la cotización ${line.name}`
      : "Empuja una cotización sin respuesta";
  return {
    name: line.named ? line.name : null,
    title,
    detail:
      "Está enviada y sin respuesta. Pregunta si tienen dudas o si quieren ajustar el alcance antes de que venza.",
  };
}

function firstContactAction(line: SnapshotLine): FallbackCandidate {
  return {
    name: line.named ? line.name : null,
    title: line.named
      ? `Haz el primer contacto con ${shortName(line.name)}`
      : "Haz un primer contacto pendiente",
    detail:
      "Está en tu pipeline y nadie le ha escrito. Ábrele con lo que vendes y un resultado concreto en la primera línea.",
  };
}

function coldLeadAction(line: SnapshotLine): FallbackCandidate {
  return {
    name: line.named ? line.name : null,
    title: line.named
      ? `Reactiva a ${shortName(line.name)}`
      : "Reactiva un lead frío",
    detail:
      "Lleva tiempo sin respuesta o sin movimiento. Escríbele con una razón nueva para hablar, no con un “¿pudiste revisarlo?”.",
  };
}

const PROSPECTING_ACTIONS: DigestAction[] = [
  {
    title: "Prospecta con tu oferta actual",
    detail:
      "Extrae o asigna clientes alineados a tu cliente ideal y contacta hoy a los primeros de la lista.",
  },
  {
    title: "Enfoca la extracción en tus mejores nichos",
    detail:
      "Elige una o dos categorías donde ya hayas cerrado y extrae ahí antes de ampliar el radio.",
  },
  {
    title: "Deja listo tu mensaje de primer contacto",
    detail:
      "Dos líneas: qué vendes y un resultado concreto. Así el equipo contacta rápido y sin improvisar.",
  },
];

/**
 * Completa el digest cuando el modelo devuelve menos de 3 pasos. Usa clientes
 * reales del snapshot (nunca inventa nombres) en el orden de prioridad del
 * prompt: primero uno de cada tipo y luego el resto. Salta a quien el modelo
 * ya mencionó. Si el pipeline no alcanza, termina con pasos de prospección.
 * Nunca habla de que la IA falló: para el usuario es un paso más.
 */
export function fallbackDigestActions(
  snapshot: DailyDigestSnapshot,
  existing: DigestAction[] = [],
): DigestAction[] {
  const mentioned = existing
    .map((action) => `${action.title} ${action.detail}`)
    .join("\n")
    .toLowerCase();
  const groups: FallbackCandidate[][] = [
    snapshot.overdueFollowUps.map(overdueAction),
    snapshot.quotesWithoutReply.map(quoteAction),
    snapshot.uncontactedLeads.map(firstContactAction),
    snapshot.coldLeads.map(coldLeadAction),
  ];
  const candidates: FallbackCandidate[] = [
    ...groups.flatMap((group) => group.slice(0, 1)),
    ...groups.flatMap((group) => group.slice(1)),
    ...PROSPECTING_ACTIONS.map((action) => ({ ...action, name: null })),
  ];

  const usedNames = new Set<string>();
  const usedTitles = new Set(
    existing.map((action) => action.title.toLowerCase()),
  );
  const picked: DigestAction[] = [];
  for (const candidate of candidates) {
    const nameKey = candidate.name?.toLowerCase() ?? null;
    const titleKey = candidate.title.toLowerCase();
    if (nameKey && (usedNames.has(nameKey) || mentioned.includes(nameKey))) {
      continue;
    }
    if (usedTitles.has(titleKey)) continue;
    if (nameKey) usedNames.add(nameKey);
    usedTitles.add(titleKey);
    picked.push({ title: candidate.title, detail: candidate.detail });
  }
  return picked;
}

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
  const businessName = row.businessLead?.businessName?.trim();
  return {
    name: businessName || "Lead",
    named: Boolean(businessName),
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
  // El estatus es de la empresa; lo del vendedor = estatus de los leads que tiene asignados.
  const sellerStatus = params.salesPersonId
    ? { businessLead: { salesPerson: { some: { id: { equals: params.salesPersonId } } } } }
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
          ...(params.salesPersonId ? [sellerStatus] : []),
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
      named: Boolean(row.lead?.businessName?.trim()),
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
      named: Boolean(row.businessLead?.businessName?.trim()),
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
