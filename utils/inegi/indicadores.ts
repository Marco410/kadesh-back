import {
  INEGI_GEOGRAPHIC_LEVEL,
  type InegiGeographicLevel,
} from "../../models/Tech/Inegi/constants";
import { inegiFetch } from "./throttle";
import type { InegiIndicatorResponse, MappedIndicator } from "./types";

const INDICADORES_BASE =
  "https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR";

function indicadoresToken(): string {
  const token = process.env.INEGI_INDICADORES_TOKEN?.trim();
  if (!token) {
    throw new Error("INEGI_INDICADORES_TOKEN no configurada");
  }
  return token;
}

export function geographicLevelFromCode(code: string): InegiGeographicLevel {
  const digits = code.replace(/\D/g, "");
  if (!digits || digits === "0" || digits === "00") {
    return INEGI_GEOGRAPHIC_LEVEL.NACIONAL;
  }
  if (digits.length <= 2) return INEGI_GEOGRAPHIC_LEVEL.ESTATAL;
  return INEGI_GEOGRAPHIC_LEVEL.MUNICIPAL;
}

export function indicatorCacheKey(
  indicatorId: string,
  geographicCode: string,
  period: string,
): string {
  return `${indicatorId}:${geographicCode}:${period}`;
}

function parseValue(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function getIndicator(
  indicatorId: string,
  geographicArea: string,
  recent = true,
  source: "BISE" | "BIE" = "BISE",
): Promise<InegiIndicatorResponse> {
  const token = indicadoresToken();
  const area = geographicArea.trim() || "00";
  const url = `${INDICADORES_BASE}/${encodeURIComponent(indicatorId)}/es/${encodeURIComponent(area)}/${recent}/${source}/2.0/${token}?type=json`;
  const res = await inegiFetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `INEGI Indicadores HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  try {
    return JSON.parse(text) as InegiIndicatorResponse;
  } catch {
    throw new Error(
      `INEGI Indicadores devolvió una respuesta no JSON: ${text.slice(0, 200)}`,
    );
  }
}

export function mapIndicatorResponse(
  indicatorId: string,
  geographicCode: string,
  payload: InegiIndicatorResponse,
  fallbackName?: string,
): MappedIndicator[] {
  const series = payload.Series ?? [];
  const mapped: MappedIndicator[] = [];
  const level = geographicLevelFromCode(geographicCode);

  for (const item of series) {
    const unit = item.UNIT ?? "";
    const name =
      fallbackName ||
      payload.Header?.Name ||
      item.INDICADOR ||
      indicatorId;
    for (const obs of item.OBSERVATIONS ?? []) {
      const period = String(obs.TIME_PERIOD ?? "").trim();
      if (!period) continue;
      mapped.push({
        cacheKey: indicatorCacheKey(indicatorId, geographicCode, period),
        indicatorId,
        indicatorName: name,
        geographicLevel: level,
        geographicCode,
        period,
        value: parseValue(obs.OBS_VALUE),
        unit,
      });
    }
  }
  return mapped;
}
