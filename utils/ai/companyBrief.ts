import { KeystoneContext } from "@keystone-6/core/types";
import { AI_INSIGHT_KIND } from "../../models/Saas/Tech/AiInsight/constants";
import type { DigestInsightRecord } from "./dailyDigest";

export const COMPANY_BRIEF_REFERENCE_KEY = "company_brief";

const INSIGHT_QUERY =
  "id referenceKey content structuredData generatedAt salesPerson { id }";

export const COMPANY_BRIEF_PILLAR_KEYS = [
  "onboardingMainOffer",
  "onboardingIdealCustomer",
  "onboardingAvgTicketValue",
  "onboardingSalesPain",
] as const;

export type CompanyBriefPillarKey =
  (typeof COMPANY_BRIEF_PILLAR_KEYS)[number];

export type CompanyBriefPillar = {
  key: CompanyBriefPillarKey;
  title: string;
  summary: string;
  gaps: string[];
};

export type CompanyBriefInsightPayload = {
  id: string;
  generatedAt: string | null;
  sourceHash: string;
  pillars: CompanyBriefPillar[];
};

const PILLAR_META: Record<
  CompanyBriefPillarKey,
  { title: string; emptySummary: string; emptyGaps: string[] }
> = {
  onboardingMainOffer: {
    title: 'El "Qué" — Oferta principal',
    emptySummary: "Todavía no describiste qué vendes.",
    emptyGaps: [
      "Qué producto o servicio ofreces, en una frase",
      "Qué resultado concreto le das al cliente",
      "Si es un SaaS, un servicio o un producto",
    ],
  },
  onboardingIdealCustomer: {
    title: 'El "Quién" — Cliente ideal',
    emptySummary: "Todavía no dijiste a quién le vendes.",
    emptyGaps: [
      "Industria o tipo de empresa que sí te compra",
      "Cargo de quien decide la compra",
      "Tamaño o geografía del cliente ideal",
    ],
  },
  onboardingAvgTicketValue: {
    title: 'El "Cuánto" — Ticket o valor',
    emptySummary: "Todavía no hay un ticket o valor de referencia.",
    emptyGaps: [
      "Precio o rango (y moneda)",
      "Si es mensual, por proyecto o por resultado",
      "Qué incluye ese precio",
    ],
  },
  onboardingSalesPain: {
    title: 'El "Cómo" — Adquisición y dolores al vender',
    emptySummary: "Todavía no contaste cómo consigues clientes ni qué te cuesta vender.",
    emptyGaps: [
      "Canal con el que hoy llegan clientes (demo, referidos, frío…)",
      "Qué se traba más al cerrar",
      "Cuál es el siguiente paso después del primer contacto",
    ],
  },
};

export type CompanyBriefSource = {
  name?: string | null;
  onboardingMainOffer?: string | null;
  onboardingIdealCustomer?: string | null;
  onboardingAvgTicketValue?: string | null;
  onboardingSalesPain?: string | null;
};

export function companyBriefSourceHash(company: CompanyBriefSource): string {
  return COMPANY_BRIEF_PILLAR_KEYS.map(
    (key) => company[key]?.trim() ?? "",
  ).join("\n---\n");
}

export const COMPANY_BRIEF_FEATURE_PROMPT = `Resume lo que YA se sabe de ESTA empresa y señala huecos concretos en cada pilar.
Responde SOLO con JSON válido, sin markdown:
{"pillars":[{"key":"onboardingMainOffer","summary":"...","gaps":["..."]},{"key":"onboardingIdealCustomer","summary":"...","gaps":["..."]},{"key":"onboardingAvgTicketValue","summary":"...","gaps":["..."]},{"key":"onboardingSalesPain","summary":"...","gaps":["..."]}]}
Reglas:
- Exactamente esas 4 keys, en ese orden.
- summary: 1 o 2 frases parafraseando SOLO lo que escribieron. Si está vacío, di que aún no hay nada de ese punto. No inventes datos.
- gaps: 1 a 3 puntos exactos que el usuario NO mencionó y debería (diferenciador, geografía, cargo que compra, moneda, canal, siguiente paso). Si el texto está muy completo, 1 hueco fino o lista vacía.
- Tono: ya conocemos el negocio por lo que van capturando. Nunca digas que esto se reenvía, se inyecta o alimenta cada llamada.`;

export function companyBriefUserPrompt(company: CompanyBriefSource): string {
  const line = (label: string, value?: string | null) =>
    `- ${label}: ${value?.trim() || "(sin definir)"}`;
  return [
    "Perfil de negocio a resumir:",
    line("Empresa", company.name),
    line('El "Qué" — Oferta principal', company.onboardingMainOffer),
    line('El "Quién" — Cliente ideal', company.onboardingIdealCustomer),
    line('El "Cuánto" — Ticket o valor', company.onboardingAvgTicketValue),
    line(
      'El "Cómo" — Adquisición y dolores al vender',
      company.onboardingSalesPain,
    ),
  ].join("\n");
}

export function fallbackCompanyBriefPillars(
  company: CompanyBriefSource,
): CompanyBriefPillar[] {
  return COMPANY_BRIEF_PILLAR_KEYS.map((key) => {
    const meta = PILLAR_META[key];
    const raw = company[key]?.trim() ?? "";
    if (!raw) {
      return {
        key,
        title: meta.title,
        summary: meta.emptySummary,
        gaps: meta.emptyGaps,
      };
    }
    const summary =
      raw.length > 220 ? `${raw.slice(0, 217).trim()}…` : raw;
    const gaps =
      raw.length < 80
        ? meta.emptyGaps.slice(0, 2)
        : raw.length < 160
          ? meta.emptyGaps.slice(0, 1)
          : [];
    return { key, title: meta.title, summary, gaps };
  });
}

function parseJsonObject(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseCompanyBriefPillars(
  text: string,
  company: CompanyBriefSource,
): CompanyBriefPillar[] {
  const parsed = parseJsonObject(text);
  const raw = Array.isArray((parsed as { pillars?: unknown } | null)?.pillars)
    ? ((parsed as { pillars: unknown[] }).pillars)
    : [];
  const byKey = new Map<string, { summary: string; gaps: string[] }>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? "").trim();
    const summary = String(row.summary ?? "").trim();
    const gaps = Array.isArray(row.gaps)
      ? row.gaps
          .map((gap) => String(gap ?? "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (!key || !summary) continue;
    byKey.set(key, { summary, gaps });
  }
  const fallback = fallbackCompanyBriefPillars(company);
  return fallback.map((pillar) => {
    const fromAi = byKey.get(pillar.key);
    if (!fromAi) return pillar;
    return {
      ...pillar,
      summary: fromAi.summary,
      gaps: fromAi.gaps,
    };
  });
}

function pillarsFromStructuredData(
  data: unknown,
  company: CompanyBriefSource,
): CompanyBriefPillar[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { pillars?: unknown }).pillars;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const fallback = fallbackCompanyBriefPillars(company);
  const byKey = new Map(
    raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((row) => [String(row.key ?? ""), row] as const),
  );
  return fallback.map((pillar) => {
    const row = byKey.get(pillar.key);
    if (!row) return pillar;
    const summary = String(row.summary ?? "").trim();
    const gaps = Array.isArray(row.gaps)
      ? row.gaps.map((gap) => String(gap ?? "").trim()).filter(Boolean)
      : [];
    return {
      ...pillar,
      summary: summary || pillar.summary,
      gaps,
    };
  });
}

export function sourceHashFromStructuredData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  return String((data as { sourceHash?: unknown }).sourceHash ?? "");
}

export function toCompanyBriefPayload(
  row: DigestInsightRecord,
  company: CompanyBriefSource,
): CompanyBriefInsightPayload {
  const pillars =
    pillarsFromStructuredData(row.structuredData, company) ??
    fallbackCompanyBriefPillars(company);
  return {
    id: row.id,
    generatedAt: row.generatedAt ?? null,
    sourceHash: sourceHashFromStructuredData(row.structuredData),
    pillars,
  };
}

export function formatBriefAsContent(pillars: CompanyBriefPillar[]): string {
  return pillars
    .map((pillar) => {
      const gaps =
        pillar.gaps.length > 0
          ? `\nHuecos: ${pillar.gaps.join("; ")}`
          : "";
      return `${pillar.title}\n${pillar.summary}${gaps}`;
    })
    .join("\n\n");
}

export async function findCompanyBrief(
  context: KeystoneContext,
  companyId: string,
): Promise<DigestInsightRecord | null> {
  const rows = (await context.sudo().query.TechAiInsight.findMany({
    where: {
      company: { id: { equals: companyId } },
      kind: { equals: AI_INSIGHT_KIND.COMPANY_BRIEF },
      referenceKey: { equals: COMPANY_BRIEF_REFERENCE_KEY },
    },
    take: 5,
    orderBy: [{ generatedAt: "desc" }],
    query: INSIGHT_QUERY,
  })) as Array<DigestInsightRecord & { salesPerson?: { id: string } | null }>;
  return rows.find((row) => !row.salesPerson) ?? null;
}

export async function saveCompanyBrief(
  context: KeystoneContext,
  params: {
    companyId: string;
    pillars: CompanyBriefPillar[];
    sourceHash: string;
    existingId?: string;
  },
): Promise<DigestInsightRecord> {
  const data: Record<string, unknown> = {
    kind: AI_INSIGHT_KIND.COMPANY_BRIEF,
    referenceKey: COMPANY_BRIEF_REFERENCE_KEY,
    content: formatBriefAsContent(params.pillars),
    structuredData: {
      sourceHash: params.sourceHash,
      pillars: params.pillars,
    },
    generatedAt: new Date().toISOString(),
    company: { connect: { id: params.companyId } },
  };

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
