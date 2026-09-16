/**
 * IDs del Banco de Indicadores (BISE) para el arranque.
 * Verificar en https://www.inegi.org.mx/servicios/api_indicadores.html
 * si INEGI los retira o renumera.
 */
export const INEGI_INDICATOR_CATALOG = [
  {
    id: "1002000001",
    name: "Población total",
    unit: "Personas",
  },
  {
    id: "1002000002",
    name: "Población hombres",
    unit: "Personas",
  },
  {
    id: "1002000003",
    name: "Población mujeres",
    unit: "Personas",
  },
  {
    id: "6207019034",
    name: "Unidades económicas",
    unit: "Unidades",
  },
  {
    id: "6200001817",
    name: "Personal ocupado total",
    unit: "Personas",
  },
  {
    id: "5300000002",
    name: "Población ocupada",
    unit: "Personas",
  },
  {
    id: "6207061840",
    name: "Producto interno bruto",
    unit: "Miles de pesos",
  },
] as const;

export type InegiIndicatorCatalogEntry =
  (typeof INEGI_INDICATOR_CATALOG)[number];

/** Claves de entidad federativa (2 dígitos) para precarga estatal. */
export const MEXICO_STATE_CODES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
] as const;

export function findCatalogIndicator(id: string) {
  return INEGI_INDICATOR_CATALOG.find((item) => item.id === id);
}
