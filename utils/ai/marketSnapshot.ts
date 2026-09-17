import { KeystoneContext } from "@keystone-6/core/types";
import { AI_INSIGHT_KIND } from "../../models/Saas/Tech/AiInsight/constants";
import { DIGEST_TIMEZONE } from "./dailyDigest";
import { INEGI_INDICATOR_CATALOG } from "../inegi/indicatorCatalog";

const SNAPSHOT_ACTIVITY_CAP = 8;
const ESTABLISHMENT_SAMPLE = 2000;

export type MarketSnapshotParams = {
  state?: string | null;
  municipality?: string | null;
  activity?: string | null;
  geographicCode?: string | null;
};

export type MarketActivityCount = {
  name: string;
  scianCode: string | null;
  count: number;
};

export type MarketIndicatorLine = {
  name: string;
  period: string;
  value: number | null;
  unit: string;
  geographicCode: string;
};

export type MarketSnapshot = {
  monthKey: string;
  state: string;
  municipality: string;
  activity: string;
  geographicCode: string;
  totalSampled: number;
  activities: MarketActivityCount[];
  indicators: MarketIndicatorLine[];
};

export function marketMonthKey(timeZone = DIGEST_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

export function marketReferenceKey(params: MarketSnapshotParams, monthKey: string): string {
  const state = (params.state ?? "*").trim() || "*";
  const municipality = (params.municipality ?? "*").trim() || "*";
  const activity = (params.activity ?? "*").trim() || "*";
  return `${state}:${municipality}:${activity}:${monthKey}`;
}

function containsFilter(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "*") return null;
  return { contains: trimmed };
}

export async function gatherMarketSnapshot(
  context: KeystoneContext,
  params: MarketSnapshotParams,
): Promise<MarketSnapshot> {
  const monthKey = marketMonthKey();
  const stateFilter = containsFilter(params.state);
  const municipalityFilter = containsFilter(params.municipality);
  const activityFilter = containsFilter(params.activity);

  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (stateFilter) and.push({ state: stateFilter });
  if (municipalityFilter) and.push({ municipality: municipalityFilter });
  if (activityFilter) {
    and.push({
      economicActivity: {
        OR: [{ name: activityFilter }, { scianCode: activityFilter }],
      },
    });
  }
  if (and.length) where.AND = and;

  const rows = (await context.sudo().query.TechInegiEstablishment.findMany({
    where,
    take: ESTABLISHMENT_SAMPLE,
    query: "id economicActivity { name scianCode }",
  })) as Array<{
    id: string;
    economicActivity?: { name?: string | null; scianCode?: string | null } | null;
  }>;

  const counts = new Map<string, MarketActivityCount>();
  for (const row of rows) {
    const name = row.economicActivity?.name?.trim() || "Sin giro";
    const scianCode = row.economicActivity?.scianCode ?? null;
    const key = scianCode || name;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { name, scianCode, count: 1 });
  }

  const activities = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, SNAPSHOT_ACTIVITY_CAP);

  const geographicCode = params.geographicCode?.trim() || "";
  const geoCodes = geographicCode
    ? [geographicCode, geographicCode.slice(0, 2), "00"].filter(
        (code, index, all) => all.indexOf(code) === index,
      )
    : [];

  const catalogIds = INEGI_INDICATOR_CATALOG.map((item) => item.id);
  const indicatorRows = geoCodes.length
    ? ((await context.sudo().query.TechInegiIndicator.findMany({
        where: {
          geographicCode: { in: geoCodes },
          indicatorId: { in: [...catalogIds] },
        },
        take: 40,
        orderBy: [{ fetchedAt: "desc" }],
        query: "indicatorName period value unit geographicCode indicatorId",
      })) as MarketIndicatorLine[])
    : [];

  const seen = new Set<string>();
  const indicators: MarketIndicatorLine[] = [];
  for (const row of indicatorRows) {
    const key = `${row.name}:${row.geographicCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    indicators.push(row);
    if (indicators.length >= SNAPSHOT_ACTIVITY_CAP) break;
  }

  return {
    monthKey,
    state: params.state?.trim() || "*",
    municipality: params.municipality?.trim() || "*",
    activity: params.activity?.trim() || "*",
    geographicCode: geographicCode || "*",
    totalSampled: rows.length,
    activities,
    indicators,
  };
}

export function formatMarketSnapshotPrompt(snapshot: MarketSnapshot): string {
  const activityLines = snapshot.activities.length
    ? snapshot.activities
        .map(
          (item) =>
            `- ${item.name}${item.scianCode ? ` (${item.scianCode})` : ""}: ${item.count}`,
        )
        .join("\n")
    : "- (sin establecimientos DENUE en el recorte)";

  const indicatorLines = snapshot.indicators.length
    ? snapshot.indicators
        .map((item) => {
          const value =
            item.value == null
              ? "s/d"
              : item.value.toLocaleString("es-MX", { maximumFractionDigits: 1 });
          return `- ${item.name} [${item.geographicCode} ${item.period}]: ${value} ${item.unit ?? ""}`.trim();
        })
        .join("\n")
    : "- (sin indicadores BIE cacheados para esa geografía)";

  return [
    `Mes (México): ${snapshot.monthKey}`,
    `Zona: estado=${snapshot.state}; municipio=${snapshot.municipality}; giro=${snapshot.activity}`,
    `Código geo BIE: ${snapshot.geographicCode}`,
    `Muestra DENUE (máx. ${ESTABLISHMENT_SAMPLE} filas): ${snapshot.totalSampled} establecimientos`,
    "Top giros en la muestra:",
    activityLines,
    "Indicadores oficiales cacheados:",
    indicatorLines,
  ].join("\n");
}

export const MARKET_ANALYSIS_FEATURE_PROMPT = `
Analiza el mercado local con los datos oficiales (DENUE / indicadores INEGI) y el perfil de la empresa.
Devuelve JSON con esta forma exacta:
{"summary":"2-4 oraciones","actions":[{"title":"...","detail":"..."},{"title":"...","detail":"..."},{"title":"...","detail":"..."}]}
Las 3 actions deben ser pasos comerciales concretos para esta empresa en esa zona.
No inventes cifras que no estén en el snapshot. Si la muestra es chica, dilo.
`.trim();

const INSIGHT_QUERY =
  "id referenceKey content structuredData generatedAt";

export async function findMarketInsight(
  context: KeystoneContext,
  companyId: string,
  referenceKey: string,
) {
  const [row] = await context.sudo().query.TechAiInsight.findMany({
    where: {
      company: { id: { equals: companyId } },
      kind: { equals: AI_INSIGHT_KIND.MARKET_ANALYSIS },
      referenceKey: { equals: referenceKey },
    },
    take: 1,
    orderBy: [{ generatedAt: "desc" }],
    query: INSIGHT_QUERY,
  });
  return row ?? null;
}

export async function saveMarketInsight(
  context: KeystoneContext,
  params: {
    companyId: string;
    referenceKey: string;
    content: string;
    structuredData: unknown;
    existingId?: string;
  },
) {
  const data = {
    kind: AI_INSIGHT_KIND.MARKET_ANALYSIS,
    referenceKey: params.referenceKey,
    content: params.content,
    structuredData: params.structuredData,
    generatedAt: new Date().toISOString(),
    company: { connect: { id: params.companyId } },
  };

  if (params.existingId) {
    return context.sudo().query.TechAiInsight.updateOne({
      where: { id: params.existingId },
      data,
      query: INSIGHT_QUERY,
    });
  }

  return context.sudo().query.TechAiInsight.createOne({
    data,
    query: INSIGHT_QUERY,
  });
}

export function parseMarketInsight(text: string): {
  summary: string;
  actions: Array<{ title: string; detail: string }>;
} {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      summary: text.trim().slice(0, 800) || "No se pudo interpretar el análisis.",
      actions: [],
    };
  }
  try {
    const parsed = JSON.parse(match[0]) as {
      summary?: string;
      actions?: Array<{ title?: string; detail?: string }>;
    };
    const actions = (parsed.actions ?? [])
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        detail: String(item.detail ?? "").trim(),
      }))
      .filter((item) => item.title && item.detail)
      .slice(0, 3);
    return {
      summary: String(parsed.summary ?? "").trim() || text.trim().slice(0, 800),
      actions,
    };
  } catch {
    return {
      summary: text.trim().slice(0, 800),
      actions: [],
    };
  }
}
