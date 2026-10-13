export type ParsedChatMessage = {
  timestamp: Date;
  sender: string;
  body: string;
};

// iOS: [12/03/2024, 9:41:05 AM] Juan Pérez: Hola
const IOS_LINE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?\s?[Mm]\.?)?)\]\s*([^:]+):\s?(.*)$/;

// Android: 12/03/2024, 9:41 - Juan Pérez: Hola  (a veces con espacio raro / guion en unicode)
const ANDROID_LINE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?\s?[Mm]\.?)?)\s*[-–]\s*([^:]+):\s?(.*)$/;

function parseTimeParts(raw: string): { hour: number; minute: number; second: number } {
  const trimmed = raw.trim();
  const isPM = /[Pp]\.?\s?[Mm]\.?$/.test(trimmed);
  const isAM = /[Aa]\.?\s?[Mm]\.?$/.test(trimmed);
  const numeric = trimmed.replace(/[AaPp]\.?\s?[Mm]\.?$/, "").trim();
  const parts = numeric.split(":").map((p) => parseInt(p, 10));
  let hour = parts[0] || 0;
  const minute = parts[1] || 0;
  const second = parts[2] || 0;

  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return { hour, minute, second };
}

type DateOrder = "dmy" | "mdy";

type RawLine = {
  d1: number;
  d2: number;
  year: number;
  timeRaw: string;
  sender: string;
  body: string;
};

/** Un día de margen: un export con la hora del teléfono un poco adelantada no cuenta como futuro. */
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

function buildDate(line: RawLine, order: DateOrder): Date {
  const day = order === "dmy" ? line.d1 : line.d2;
  const month = order === "dmy" ? line.d2 : line.d1;
  const { hour, minute, second } = parseTimeParts(line.timeRaw);
  return new Date(line.year, month - 1, day, hour, minute, second);
}

/** Qué tan mal se ve un orden: fechas futuras pesan mucho más que saltos hacia atrás. */
function orderPenalty(lines: RawLine[], order: DateOrder, now: number): number {
  let penalty = 0;
  let previous = -Infinity;
  for (const line of lines) {
    const time = buildDate(line, order).getTime();
    if (time > now + FUTURE_SLACK_MS) penalty += 100;
    if (time < previous) penalty += 1;
    previous = time;
  }
  return penalty;
}

/**
 * `d1/d2/yyyy` es DD/MM (teléfono en español) o MM/DD (en inglés de EE. UU.), y el export no
 * lo dice. Se decide con todo el archivo, no línea por línea:
 * - si algún d1 > 12 es DD/MM; si algún d2 > 12 es MM/DD;
 * - si ninguno lo delata, gana el orden sin fechas futuras y que va en orden cronológico
 *   (WhatsApp exporta en orden); empate → DD/MM (es-MX).
 * Antes se asumía DD/MM por línea y un chat en MM/DD quedaba con fechas futuras ("9 de
 * diciembre" en vez de 12 de septiembre) que tapaban todo en la Actividad de Operaciones.
 */
export function detectDateOrder(lines: RawLine[], now = Date.now()): DateOrder {
  if (lines.some((l) => l.d1 > 12)) return "dmy";
  if (lines.some((l) => l.d2 > 12)) return "mdy";
  return orderPenalty(lines, "mdy", now) < orderPenalty(lines, "dmy", now) ? "mdy" : "dmy";
}

/**
 * Parsea un .txt de "Exportar chat" de WhatsApp (formato Android o iOS). Líneas que no
 * matchean el patrón de timestamp+remitente se concatenan al mensaje anterior (mensajes
 * multilínea); avisos del sistema sin "Remitente: texto" claro simplemente no matchean y se
 * pierden (o quedan pegados al mensaje previo si aparecen después de uno real).
 */
export function parseWhatsAppChatExport(text: string): ParsedChatMessage[] {
  const lines = text.split(/\r?\n/);
  const raw: RawLine[] = [];

  for (const rawLine of lines) {
    // Algunos exports usan ‎ (LRM) al inicio de línea.
    const line = rawLine.replace(/^‎/, "");
    if (!line.trim()) continue;

    const iosMatch = line.match(IOS_LINE);
    const androidMatch = !iosMatch ? line.match(ANDROID_LINE) : null;
    const match = iosMatch || androidMatch;

    if (match) {
      const [, d1, d2, yearRaw, time, senderRaw, bodyRaw] = match;
      raw.push({
        d1: parseInt(d1, 10),
        d2: parseInt(d2, 10),
        year: yearRaw.length === 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10),
        timeRaw: time,
        sender: senderRaw.trim(),
        body: bodyRaw.trim(),
      });
      continue;
    }

    // No matchea: continuación del mensaje anterior (o se ignora si no hay ninguno todavía).
    const last = raw[raw.length - 1];
    if (last) {
      last.body = `${last.body}\n${line}`.trim();
    }
  }

  const order = detectDateOrder(raw);
  return raw.map((line) => ({
    timestamp: buildDate(line, order),
    sender: line.sender,
    body: line.body,
  }));
}

/** Nombres de remitente distintos, en orden de aparición. */
export function distinctSenders(messages: ParsedChatMessage[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const msg of messages) {
    if (!seen.has(msg.sender)) {
      seen.add(msg.sender);
      result.push(msg.sender);
    }
  }
  return result;
}
