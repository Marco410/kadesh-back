import { KeystoneContext } from "@keystone-6/core/types";
import type { GoogleCalendarListEntry } from "./client";

/**
 * Sincroniza las filas de GoogleCalendarSelection de una cuenta con la lista de calendarios
 * de Google: crea los nuevos (con `isSelected: false`), actualiza nombre/color de los que ya
 * existen SIN tocar su `isSelected`, y elimina los que ya no existen en Google.
 */
export async function syncCalendarList(
  context: KeystoneContext,
  accountId: string,
  calendars: GoogleCalendarListEntry[],
): Promise<number> {
  const sudo = context.sudo();
  const existing = (await sudo.query.GoogleCalendarSelection.findMany({
    where: { account: { id: { equals: accountId } } },
    query: "id googleCalendarId",
  })) as { id: string; googleCalendarId: string }[];
  const existingByCalendarId = new Map(existing.map((s) => [s.googleCalendarId, s.id]));

  for (const cal of calendars) {
    const data = {
      calendarName: cal.summary,
      isPrimary: cal.primary,
      colorHex: cal.backgroundColor,
    };
    const existingId = existingByCalendarId.get(cal.id);
    if (existingId) {
      await sudo.query.GoogleCalendarSelection.updateOne({ where: { id: existingId }, data });
    } else {
      await sudo.query.GoogleCalendarSelection.createOne({
        data: {
          ...data,
          googleCalendarId: cal.id,
          isSelected: false,
          account: { connect: { id: accountId } },
        },
      });
    }
  }

  const remoteIds = new Set(calendars.map((c) => c.id));
  const stale = existing.filter((s) => !remoteIds.has(s.googleCalendarId));
  if (stale.length > 0) {
    await deleteSelections(context, stale.map((s) => s.id));
  }
  return calendars.length;
}

/** Borra selecciones y, antes, sus links a eventos (evita links huérfanos). */
export async function deleteSelections(
  context: KeystoneContext,
  selectionIds: string[],
): Promise<void> {
  if (selectionIds.length === 0) return;
  const sudo = context.sudo();
  const links = (await sudo.query.TechCalendarEventGoogleLink.findMany({
    where: { calendarSelection: { id: { in: selectionIds } } },
    query: "id",
  })) as { id: string }[];
  if (links.length > 0) {
    await sudo.query.TechCalendarEventGoogleLink.deleteMany({
      where: links.map((l) => ({ id: l.id })),
    });
  }
  await sudo.query.GoogleCalendarSelection.deleteMany({
    where: selectionIds.map((id) => ({ id })),
  });
}
