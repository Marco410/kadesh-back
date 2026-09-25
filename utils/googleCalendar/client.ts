import { GOOGLE_CALENDAR_API } from "./constants";
import { GoogleCalendarError } from "./errors";

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
  accessRole: string | null;
};

/** Cuerpo mínimo de evento que enviamos a Google. */
export type GoogleEventBody = {
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

export type GoogleEventItem = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function googleFetch<T = any>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  { allowStatuses = [] as number[] } = {},
): Promise<T | null> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (allowStatuses.includes(res.status)) return null;

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as any;
    throw new GoogleCalendarError(
      data?.error?.message || `Google Calendar respondió ${res.status}`,
      res.status,
      data?.error?.errors?.[0]?.reason ?? null,
    );
  }

  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function listCalendarList(
  accessToken: string,
): Promise<GoogleCalendarListEntry[]> {
  const out: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: "250", minAccessRole: "reader" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetch<any>(accessToken, `/users/me/calendarList?${params}`);
    for (const item of data?.items ?? []) {
      out.push({
        id: item.id,
        summary: item.summaryOverride || item.summary || item.id,
        primary: !!item.primary,
        backgroundColor: item.backgroundColor ?? null,
        accessRole: item.accessRole ?? null,
      });
    }
    pageToken = data?.nextPageToken;
  } while (pageToken);
  return out;
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEventItem[]> {
  const out: GoogleEventItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetch<any>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );
    for (const item of data?.items ?? []) {
      if (item.status === "cancelled") continue;
      out.push(item);
    }
    pageToken = data?.nextPageToken;
  } while (pageToken);
  return out;
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  body: GoogleEventBody,
): Promise<GoogleEventItem> {
  const data = await googleFetch<GoogleEventItem>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data as GoogleEventItem;
}

/** Devuelve `null` si el evento ya no existe en Google (404/410). */
export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: GoogleEventBody,
): Promise<GoogleEventItem | null> {
  return googleFetch<GoogleEventItem>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PUT", body: JSON.stringify(body) },
    { allowStatuses: [404, 410] },
  );
}

/** Idempotente: 404/410 (ya borrado) no es error. */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
    { allowStatuses: [404, 410] },
  );
}
