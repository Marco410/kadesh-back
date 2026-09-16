export const INEGI_SYNC_SOURCE = {
  API: "api",
  BULK_IMPORT: "bulk_import",
} as const;

export type InegiSyncSource =
  (typeof INEGI_SYNC_SOURCE)[keyof typeof INEGI_SYNC_SOURCE];

export const INEGI_SYNC_SOURCE_OPTIONS = [
  { label: "API en vivo", value: INEGI_SYNC_SOURCE.API },
  { label: "Carga masiva", value: INEGI_SYNC_SOURCE.BULK_IMPORT },
] as const;

export const INEGI_GEOGRAPHIC_LEVEL = {
  NACIONAL: "nacional",
  ESTATAL: "estatal",
  MUNICIPAL: "municipal",
} as const;

export type InegiGeographicLevel =
  (typeof INEGI_GEOGRAPHIC_LEVEL)[keyof typeof INEGI_GEOGRAPHIC_LEVEL];

export const INEGI_GEOGRAPHIC_LEVEL_OPTIONS = [
  { label: "Nacional", value: INEGI_GEOGRAPHIC_LEVEL.NACIONAL },
  { label: "Estatal", value: INEGI_GEOGRAPHIC_LEVEL.ESTATAL },
  { label: "Municipal", value: INEGI_GEOGRAPHIC_LEVEL.MUNICIPAL },
] as const;

export const INEGI_GEO_BOUNDARY_LEVEL = {
  ESTADO: "estado",
  MUNICIPIO: "municipio",
  LOCALIDAD: "localidad",
} as const;

export type InegiGeoBoundaryLevel =
  (typeof INEGI_GEO_BOUNDARY_LEVEL)[keyof typeof INEGI_GEO_BOUNDARY_LEVEL];

export const INEGI_GEO_BOUNDARY_LEVEL_OPTIONS = [
  { label: "Estado", value: INEGI_GEO_BOUNDARY_LEVEL.ESTADO },
  { label: "Municipio", value: INEGI_GEO_BOUNDARY_LEVEL.MUNICIPIO },
  { label: "Localidad", value: INEGI_GEO_BOUNDARY_LEVEL.LOCALIDAD },
] as const;

/** Tope de establecimientos por mutación de sync en vivo (GraphQL síncrono). */
export const INEGI_LIVE_SYNC_CAP = 250;
