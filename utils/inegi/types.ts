export type DenueEstablishment = {
  CLEE?: string;
  Id?: string | number;
  Nombre?: string;
  Razon_social?: string;
  Clase_actividad?: string;
  Estrato?: string;
  Tipo_vialidad?: string;
  Calle?: string;
  Num_Exterior?: string;
  Num_Interior?: string;
  Colonia?: string;
  CP?: string;
  Ubicacion?: string;
  Telefono?: string;
  Correo_e?: string;
  Sitio_internet?: string;
  Tipo?: string;
  Longitud?: string | number;
  Latitud?: string | number;
  CentroComercial?: string;
  TipoCentroComercial?: string;
  NumLocal?: string;
  /** Algunos métodos / versiones incluyen código SCIAN. */
  Codigo_Act?: string;
  Clave?: string;
  Clase?: string;
  Entidad?: string;
  Municipio?: string;
  Localidad?: string;
  [key: string]: unknown;
};

export type DenueCsvRow = {
  CLEE?: string;
  Id?: string;
  Nom_Estab?: string;
  Raz_Social?: string;
  Codigo_Act?: string;
  Nombre_Act?: string;
  Per_Ocu?: string;
  Tipo_vial?: string;
  Nom_Vial?: string;
  Numero_ext?: string;
  Numero_int?: string;
  Nomb_asent?: string;
  Cod_Postal?: string;
  Entidad?: string;
  Municipio?: string;
  Localidad?: string;
  Telefono?: string;
  Correo_e?: string;
  WWW?: string;
  Latitud?: string;
  Longitud?: string;
  [key: string]: string | undefined;
};

export type MappedEstablishment = {
  clee: string;
  name: string;
  legalName: string;
  employeeStratum: string;
  scianCode: string | null;
  scianName: string | null;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  locality: string;
  municipality: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  lat: number | null;
  lng: number | null;
  rawPayload: Record<string, unknown>;
};

export type SearchByLocationParams = {
  lat: number;
  lng: number;
  radiusMeters: number;
  keyword?: string;
};

export type SearchByAreaActivityParams = {
  stateCode: string;
  municipalityCode?: string;
  localityCode?: string;
  scianCode?: string;
  keyword?: string;
  start: number;
  end: number;
};

export type InegiIndicatorObservation = {
  TIME_PERIOD: string;
  OBS_VALUE: string | null;
};

export type InegiIndicatorSeries = {
  INDICADOR?: string;
  UNIT?: string;
  UNIT_MULT?: string;
  OBSERVATIONS?: InegiIndicatorObservation[];
};

export type InegiIndicatorResponse = {
  Header?: { Name?: string; Status?: string };
  Series?: InegiIndicatorSeries[];
};

export type MappedIndicator = {
  cacheKey: string;
  indicatorId: string;
  indicatorName: string;
  geographicLevel: "nacional" | "estatal" | "municipal";
  geographicCode: string;
  period: string;
  value: number | null;
  unit: string;
};
