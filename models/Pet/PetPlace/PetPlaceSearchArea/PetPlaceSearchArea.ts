import { list } from "@keystone-6/core";
import { float, integer, text, timestamp } from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../../utils/access/tenant";

/**
 * Una fila por zona (celda de ~5 km) y tipo ya buscados en Google Places.
 * getNearbyPetPlaces la consulta para no volver a pagar la misma búsqueda:
 * solo se repite cuando la fila caduca o se pide un radio mayor.
 */
export default list({
  access: {
    operation: {
      query: ({ session }: any) => isPlatformAdmin(session),
      create: () => false,
      update: () => false,
      delete: ({ session }: any) => isPlatformAdmin(session),
    },
  },
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["key", "googleResults", "radiusKm", "searchedAt"],
      initialSort: { field: "searchedAt", direction: "DESC" },
    },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "tipo:lat:lng de la celda (ej. veterinary:19.70:-101.10)" },
    }),
    type: text(),
    lat: float(),
    lng: float(),
    radiusKm: float(),
    googleResults: integer({ defaultValue: 0 }),
    searchedAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
