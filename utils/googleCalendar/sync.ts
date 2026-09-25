import { KeystoneContext } from "@keystone-6/core/types";
import { persistGoogleCalendarSyncLog } from "./callLog";
import {
  CalendarEventSource,
  DEFAULT_EVENT_DURATION_MINUTES,
  GoogleCalendarScopeType,
  GoogleLinkStatus,
  type GoogleSyncOperation,
} from "./constants";
import {
  deleteEvent,
  insertEvent,
  listEvents,
  updateEvent,
  type GoogleEventBody,
  type GoogleEventItem,
} from "./client";
import { companyHasCalendarFeature } from "./planFeature";
import { ACCOUNT_TOKEN_QUERY, getValidAccessToken } from "./tokenManager";

type CalendarEventRecord = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean | null;
  location?: string | null;
  sourceType?: string | null;
  googleTargets?: { id: string }[] | null;
  createdBy?: { id: string } | null;
  company?: { id: string } | null;
};

const EVENT_QUERY =
  "id title description startAt endAt allDay location sourceType googleTargets { id } createdBy { id } company { id }";

/** Flag de GoogleCalendarSelection que habilita cada tipo de registro del CRM. */
const PUSH_FLAG_BY_SOURCE: Record<string, string> = {
  [CalendarEventSource.SALES_ACTIVITY]: "pushActivities",
  [CalendarEventSource.PROPOSAL]: "pushProposals",
  [CalendarEventSource.FOLLOW_UP_TASK]: "pushFollowUps",
  [CalendarEventSource.TASK]: "pushTasks",
};

const SELECTION_TARGET_QUERY = `id googleCalendarId account { ${ACCOUNT_TOKEN_QUERY} }`;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Convierte un TechCalendarEvent al cuerpo de evento de Google.
 * Convención: en eventos `allDay` las fechas se leen en UTC (los `calendarDay` del CRM se
 * guardan como 00:00Z); el fin de Google es exclusivo, por eso se suma un día.
 */
export function buildGoogleEventBody(event: CalendarEventRecord): GoogleEventBody {
  const base = {
    summary: event.title,
    ...(event.description ? { description: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
  };

  if (event.allDay) {
    const startDate = toDateOnly(event.startAt);
    const lastDay = event.endAt ? toDateOnly(event.endAt) : startDate;
    const endExclusive = new Date(new Date(`${lastDay}T00:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
    return { ...base, start: { date: startDate }, end: { date: endExclusive } };
  }

  const start = new Date(event.startAt);
  const end = event.endAt
    ? new Date(event.endAt)
    : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60_000);
  return {
    ...base,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

/**
 * Calendarios de Google que reciben un evento. Siempre deben estar seleccionados y ser
 * alcanzables por el evento (cuenta personal de quien lo creó o cuenta compartida de su
 * empresa). Además:
 * - evento nativo: solo los calendarios que se eligieron al crearlo (`googleTargets`);
 * - evento del CRM: los calendarios que tienen activado ese tipo de registro.
 */
async function resolveTargetSelections(
  context: KeystoneContext,
  event: CalendarEventRecord,
) {
  const userId = event.createdBy?.id;
  const companyId = event.company?.id;
  const owners: Record<string, unknown>[] = [];
  if (userId) {
    owners.push({
      scopeType: { equals: GoogleCalendarScopeType.PERSONAL },
      user: { id: { equals: userId } },
    });
  }
  if (companyId) {
    owners.push({
      scopeType: { equals: GoogleCalendarScopeType.COMPANY },
      company: { id: { equals: companyId } },
    });
  }
  if (owners.length === 0) return [];

  const sourceFilter: Record<string, unknown> = {};
  if (!event.sourceType || event.sourceType === CalendarEventSource.NATIVE) {
    const targetIds = (event.googleTargets ?? []).map((t) => t.id);
    if (targetIds.length === 0) return [];
    sourceFilter.id = { in: targetIds };
  } else {
    const flag = PUSH_FLAG_BY_SOURCE[event.sourceType];
    if (!flag) return [];
    sourceFilter[flag] = { equals: true };
  }

  return context.sudo().query.GoogleCalendarSelection.findMany({
    where: {
      ...sourceFilter,
      isSelected: { equals: true },
      account: { isActive: { equals: true }, OR: owners },
    },
    query: SELECTION_TARGET_QUERY,
  }) as Promise<
    { id: string; googleCalendarId: string; account: any }[]
  >;
}

async function upsertLink(
  context: KeystoneContext,
  params: {
    linkId?: string | null;
    eventId: string;
    selectionId: string;
    googleEventId?: string | null;
    status: GoogleLinkStatus;
    error?: string | null;
  },
) {
  const data = {
    ...(params.googleEventId ? { googleEventId: params.googleEventId } : {}),
    lastPushStatus: params.status,
    lastPushError: params.error ?? null,
    ...(params.status === GoogleLinkStatus.SUCCESS
      ? { lastPushedAt: new Date().toISOString() }
      : {}),
  };
  if (params.linkId) {
    await context.sudo().query.TechCalendarEventGoogleLink.updateOne({
      where: { id: params.linkId },
      data,
    });
    return;
  }
  await context.sudo().query.TechCalendarEventGoogleLink.createOne({
    data: {
      ...data,
      event: { connect: { id: params.eventId } },
      calendarSelection: { connect: { id: params.selectionId } },
    },
  });
}

/**
 * Empuja (crea o actualiza) un TechCalendarEvent a todos los calendarios de Google
 * seleccionados que le corresponden. Un fallo en un calendario no afecta a los demás
 * y nunca lanza: queda en el link y en TechGoogleCalendarSyncLog.
 */
export async function pushEventToGoogle(
  context: KeystoneContext,
  eventId: string,
): Promise<void> {
  const event = (await context.sudo().query.TechCalendarEvent.findOne({
    where: { id: eventId },
    query: EVENT_QUERY,
  })) as CalendarEventRecord | null;
  if (!event) return;

  if (event.company?.id && !(await companyHasCalendarFeature(context, event.company.id))) {
    return;
  }

  const selections = await resolveTargetSelections(context, event);
  if (selections.length === 0) return;

  const body = buildGoogleEventBody(event);

  for (const selection of selections) {
    const startedAt = Date.now();
    let operation: GoogleSyncOperation = "create";
    let linkId: string | null = null;
    try {
      const [link] = (await context.sudo().query.TechCalendarEventGoogleLink.findMany({
        where: {
          event: { id: { equals: event.id } },
          calendarSelection: { id: { equals: selection.id } },
        },
        take: 1,
        query: "id googleEventId",
      })) as { id: string; googleEventId?: string | null }[];
      linkId = link?.id ?? null;

      const accessToken = await getValidAccessToken(context, selection.account);

      let remote: GoogleEventItem | null = null;
      if (link?.googleEventId) {
        operation = "update";
        remote = await updateEvent(
          accessToken,
          selection.googleCalendarId,
          link.googleEventId,
          body,
        );
      }
      if (!remote) {
        operation = "create";
        remote = await insertEvent(accessToken, selection.googleCalendarId, body);
      }

      await upsertLink(context, {
        linkId,
        eventId: event.id,
        selectionId: selection.id,
        googleEventId: remote.id,
        status: GoogleLinkStatus.SUCCESS,
      });
      await persistGoogleCalendarSyncLog({
        context,
        accountId: selection.account.id,
        direction: "push",
        operation,
        success: true,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al enviar a Google";
      console.error(`Push a Google Calendar falló (selección ${selection.id}):`, message);
      await upsertLink(context, {
        linkId,
        eventId: event.id,
        selectionId: selection.id,
        status: GoogleLinkStatus.ERROR,
        error: message,
      }).catch((e: unknown) => console.error("No se pudo guardar el link:", e));
      await persistGoogleCalendarSyncLog({
        context,
        accountId: selection.account?.id,
        direction: "push",
        operation,
        success: false,
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}

/**
 * Borra en Google todas las copias de un evento y limpia sus links. Se llama ANTES de
 * borrar el TechCalendarEvent (beforeOperation), porque después ya no habría cómo
 * encontrar los ids remotos. Nunca lanza.
 */
export async function deleteEventFromGoogle(
  context: KeystoneContext,
  eventId: string,
): Promise<void> {
  const links = (await context.sudo().query.TechCalendarEventGoogleLink.findMany({
    where: { event: { id: { equals: eventId } } },
    query: `id googleEventId calendarSelection { ${SELECTION_TARGET_QUERY} }`,
  })) as {
    id: string;
    googleEventId?: string | null;
    calendarSelection?: { googleCalendarId: string; account: any } | null;
  }[];

  for (const link of links) {
    const selection = link.calendarSelection;
    if (!link.googleEventId || !selection) continue;
    const startedAt = Date.now();
    try {
      const accessToken = await getValidAccessToken(context, selection.account);
      await deleteEvent(accessToken, selection.googleCalendarId, link.googleEventId);
      await persistGoogleCalendarSyncLog({
        context,
        accountId: selection.account.id,
        direction: "push",
        operation: "delete",
        success: true,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al borrar en Google";
      console.error("Borrado en Google Calendar falló:", message);
      await persistGoogleCalendarSyncLog({
        context,
        accountId: selection.account?.id,
        direction: "push",
        operation: "delete",
        success: false,
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  if (links.length > 0) {
    await context
      .sudo()
      .query.TechCalendarEventGoogleLink.deleteMany({
        where: links.map((l) => ({ id: l.id })),
      })
      .catch((e: unknown) => console.error("No se pudieron limpiar los links:", e));
  }
}

export type PulledGoogleEvent = {
  id: string;
  selectionId: string;
  calendarId: string;
  calendarName: string;
  accountEmail: string;
  colorHex: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
  /** Si el evento se originó en Kadesh (push previo), id del TechCalendarEvent para deduplicar. */
  kadeshEventId: string | null;
};

type PullSelection = {
  id: string;
  googleCalendarId: string;
  calendarName?: string | null;
  colorHex?: string | null;
  account: {
    id: string;
    googleAccountEmail?: string | null;
  } & Record<string, any>;
};

export const PULL_SELECTION_QUERY = `id googleCalendarId calendarName colorHex account { googleAccountEmail ${ACCOUNT_TOKEN_QUERY} }`;

/** Trae eventos en vivo de un calendario de Google (no se guardan como TechCalendarEvent). */
export async function pullEventsForSelection(
  context: KeystoneContext,
  selection: PullSelection,
  timeMin: string,
  timeMax: string,
): Promise<PulledGoogleEvent[]> {
  const startedAt = Date.now();
  try {
    const accessToken = await getValidAccessToken(context, selection.account);
    const items = await listEvents(accessToken, selection.googleCalendarId, timeMin, timeMax);

    const remoteIds = items.map((i) => i.id);
    const links = remoteIds.length
      ? ((await context.sudo().query.TechCalendarEventGoogleLink.findMany({
          where: {
            calendarSelection: { id: { equals: selection.id } },
            googleEventId: { in: remoteIds },
          },
          query: "googleEventId event { id }",
        })) as { googleEventId: string; event?: { id: string } | null }[])
      : [];
    const kadeshByGoogleId = new Map(
      links.map((l) => [l.googleEventId, l.event?.id ?? null]),
    );

    await context.sudo().query.GoogleCalendarAccount.updateOne({
      where: { id: selection.account.id },
      data: { lastSyncedAt: new Date().toISOString(), lastSyncError: null },
    });
    await persistGoogleCalendarSyncLog({
      context,
      accountId: selection.account.id,
      direction: "pull",
      operation: "list_events",
      success: true,
      durationMs: Date.now() - startedAt,
    });

    return items.map((item) => normalizeItem(item, selection, kadeshByGoogleId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer Google Calendar";
    await context
      .sudo()
      .query.GoogleCalendarAccount.updateOne({
        where: { id: selection.account.id },
        data: { lastSyncError: message },
      })
      .catch((e: unknown) => console.error("No se pudo guardar lastSyncError:", e));
    await persistGoogleCalendarSyncLog({
      context,
      accountId: selection.account.id,
      direction: "pull",
      operation: "list_events",
      success: false,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

function normalizeItem(
  item: GoogleEventItem,
  selection: PullSelection,
  kadeshByGoogleId: Map<string, string | null>,
): PulledGoogleEvent {
  const allDay = !!item.start?.date && !item.start?.dateTime;
  return {
    id: item.id,
    selectionId: selection.id,
    calendarId: selection.googleCalendarId,
    calendarName: selection.calendarName ?? selection.googleCalendarId,
    accountEmail: selection.account.googleAccountEmail ?? "",
    colorHex: selection.colorHex ?? null,
    title: item.summary || "(Sin título)",
    description: item.description ?? null,
    location: item.location ?? null,
    start: (item.start?.dateTime ?? item.start?.date) as string,
    end: item.end?.dateTime ?? item.end?.date ?? null,
    allDay,
    htmlLink: item.htmlLink ?? null,
    kadeshEventId: kadeshByGoogleId.get(item.id) ?? null,
  };
}
