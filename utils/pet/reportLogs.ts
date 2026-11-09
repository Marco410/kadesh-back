import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Bitácora de un reporte (`AnimalLog`) desde el servidor: leer el último estado y agregar uno nuevo
 * sin mover el pin. La usan la cartilla de rescate, las solicitudes de adopción y los traspasos.
 */

export type LastLog = {
  status?: string | null;
  lat?: string | null;
  lng?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  placeLabel?: string | null;
};

export type LogLocation = { lat: string; lng: string; address?: string | null };

/** Estados en los que el animal ya tiene hogar: no se vuelve a publicar ni a adoptar. */
export const HOME_REPORT_STATUSES = ["adopted", "in_family"];

export async function lastReportLog(context: KeystoneContext, reportId: string): Promise<LastLog | null> {
  const [last] = (await context.sudo().query.AnimalLog.findMany({
    where: { animal: { id: { equals: reportId } } },
    orderBy: [{ date_status: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "status lat lng address city state country neighborhood postalCode placeLabel",
  })) as LastLog[];
  return last ?? null;
}

/**
 * Agrega una bitácora al reporte. Sin `location` repite la ubicación de la última (para que el pin
 * no se mueva); con ella, el hook de `AnimalLog` completa ciudad y estado.
 */
export async function addReportLog(
  context: KeystoneContext,
  reportId: string,
  status: string,
  notes: string,
  last: LastLog | null,
  location?: LogLocation | null,
) {
  const place = location
    ? { lat: String(location.lat), lng: String(location.lng), address: location.address ?? "" }
    : {
        lat: last?.lat ?? "",
        lng: last?.lng ?? "",
        address: last?.address ?? "",
        city: last?.city ?? "",
        state: last?.state ?? "",
        country: last?.country ?? "",
        neighborhood: last?.neighborhood ?? "",
        postalCode: last?.postalCode ?? "",
        placeLabel: last?.placeLabel ?? "",
      };
  await context.sudo().query.AnimalLog.createOne({
    data: {
      animal: { connect: { id: reportId } },
      status,
      notes,
      date_status: new Date().toISOString(),
      last_seen: false,
      ...place,
    },
    query: "id",
  });
}

/** Cierra el reporte como «Adoptado» (si no lo estaba ya). No lanza: la adopción ya quedó. */
export async function closeReportAsAdopted(context: KeystoneContext, reportId: string, notes: string) {
  try {
    const last = await lastReportLog(context, reportId);
    if (last?.status !== "adopted") await addReportLog(context, reportId, "adopted", notes, last);
  } catch (error) {
    console.error("[reportLogs] No se pudo cerrar el reporte como adoptado", { reportId }, error);
  }
}
