import { cityKey, normalizeStateCode } from "../../utils/geo/mexicoStates";
import { reverseGeocode } from "../../utils/pet/nominatim";

type Args = {
  resolvedData: Record<string, any>;
  item?: Record<string, any> | null;
};

const EMPTY_REGION = { alertCity: null, alertCityKey: null, alertStateCode: null };

/**
 * Cuando cambia el centro de la zona de alertas, guarda su municipio y estado (Nominatim). Con eso
 * los eventos con alcance «Municipio» o «Estado» saben a quién avisar (utils/notifications/eventAlerts.ts).
 * Si Nominatim falla, queda vacío y `backfillAlertRegions` lo llena después.
 */
export async function resolveAlertRegion({ resolvedData, item }: Args): Promise<Record<string, any>> {
  // `resolvedData` trae todas las llaves de la lista; las que no vienen en el cambio valen
  // `undefined`. Con `in` cualquier update de User borraba el municipio y estado de la zona.
  const latChanged = resolvedData.alertLat !== undefined;
  const lngChanged = resolvedData.alertLng !== undefined;
  if (!latChanged && !lngChanged) return resolvedData;

  const lat = latChanged ? resolvedData.alertLat : item?.alertLat;
  const lng = lngChanged ? resolvedData.alertLng : item?.alertLng;
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { ...resolvedData, ...EMPTY_REGION };
  }
  const samePoint = item && Number(item.alertLat) === Number(lat) && Number(item.alertLng) === Number(lng);
  if (samePoint && item?.alertStateCode) return resolvedData;

  const place = await reverseGeocode(Number(lat), Number(lng));
  if (!place) return { ...resolvedData, ...EMPTY_REGION };
  return {
    ...resolvedData,
    alertCity: place.city || null,
    alertCityKey: cityKey(place.city),
    alertStateCode: normalizeStateCode(place.state),
  };
}
