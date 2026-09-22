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

/**
 * `d1/d2/yyyy` es ambiguo (DD/MM vs MM/DD) sin metadata del export. Se asume DD/MM (locale
 * es-MX) salvo que d1 no pueda ser día (>31) o d2 no pueda ser mes (>12), donde se voltea.
 */
function resolveDayMonth(d1: number, d2: number): { day: number; month: number } {
  if (d2 > 12 && d1 <= 12) return { day: d2, month: d1 };
  return { day: d1, month: d2 };
}

function buildDate(
  d1: string,
  d2: string,
  yearRaw: string,
  timeRaw: string,
): Date {
  const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10);
  const { day, month } = resolveDayMonth(parseInt(d1, 10), parseInt(d2, 10));
  const { hour, minute, second } = parseTimeParts(timeRaw);
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Parsea un .txt de "Exportar chat" de WhatsApp (formato Android o iOS). Líneas que no
 * matchean el patrón de timestamp+remitente se concatenan al mensaje anterior (mensajes
 * multilínea); avisos del sistema sin "Remitente: texto" claro simplemente no matchean y se
 * pierden (o quedan pegados al mensaje previo si aparecen después de uno real).
 */
export function parseWhatsAppChatExport(text: string): ParsedChatMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: ParsedChatMessage[] = [];

  for (const rawLine of lines) {
    // Algunos exports usan ‎ (LRM) al inicio de línea.
    const line = rawLine.replace(/^‎/, "");
    if (!line.trim()) continue;

    const iosMatch = line.match(IOS_LINE);
    const androidMatch = !iosMatch ? line.match(ANDROID_LINE) : null;
    const match = iosMatch || androidMatch;

    if (match) {
      const [, d1, d2, year, time, senderRaw, bodyRaw] = match;
      messages.push({
        timestamp: buildDate(d1, d2, year, time),
        sender: senderRaw.trim(),
        body: bodyRaw.trim(),
      });
      continue;
    }

    // No matchea: continuación del mensaje anterior (o se ignora si no hay ninguno todavía).
    const last = messages[messages.length - 1];
    if (last) {
      last.body = `${last.body}\n${line}`.trim();
    }
  }

  return messages;
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
