import type {
  DenueCsvRow,
  DenueEstablishment,
  MappedEstablishment,
} from "./types";

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function parseFloatOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function slugActivity(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * SCIAN de 6 dígitos si viene; si solo hay nombre de clase, clave sintética `n:slug`
 * para agrupar el mismo giro.
 */
export function resolveScian(
  code: unknown,
  name: unknown,
): { scianCode: string | null; scianName: string | null } {
  const scianName = asString(name) || null;
  const rawCode = asString(code);
  if (rawCode) return { scianCode: rawCode, scianName };
  if (scianName) return { scianCode: `n:${slugActivity(scianName)}`, scianName };
  return { scianCode: null, scianName: null };
}

export function mapDenueApiRow(row: DenueEstablishment): MappedEstablishment | null {
  const clee = asString(row.CLEE);
  const name = asString(row.Nombre);
  if (!clee || !name) return null;

  const { scianCode, scianName } = resolveScian(
    row.Codigo_Act ?? row.Clave ?? row.Clase,
    row.Clase_actividad,
  );

  const ubicacion = asString(row.Ubicacion);
  const parts = ubicacion.split(",").map((p) => p.trim()).filter(Boolean);
  const inferredState = parts.length >= 1 ? parts[parts.length - 1] : "";
  const inferredMunicipality =
    parts.length >= 2 ? parts[parts.length - 2] : "";

  return {
    clee,
    name,
    legalName: asString(row.Razon_social),
    employeeStratum: asString(row.Estrato),
    scianCode,
    scianName,
    street: asString(row.Calle) || asString(row.Tipo_vialidad),
    exteriorNumber: asString(row.Num_Exterior),
    interiorNumber: asString(row.Num_Interior),
    neighborhood: asString(row.Colonia),
    postalCode: asString(row.CP),
    locality: asString(row.Localidad),
    municipality: asString(row.Municipio) || inferredMunicipality,
    state: asString(row.Entidad) || inferredState,
    phone: asString(row.Telefono),
    email: asString(row.Correo_e),
    website: asString(row.Sitio_internet),
    lat: parseFloatOrNull(row.Latitud),
    lng: parseFloatOrNull(row.Longitud),
    rawPayload: { ...row },
  };
}

export function mapDenueCsvRow(row: DenueCsvRow): MappedEstablishment | null {
  const clee = asString(row.CLEE);
  const name = asString(row.Nom_Estab);
  if (!clee || !name) return null;

  const { scianCode, scianName } = resolveScian(row.Codigo_Act, row.Nombre_Act);

  return {
    clee,
    name,
    legalName: asString(row.Raz_Social),
    employeeStratum: asString(row.Per_Ocu),
    scianCode,
    scianName,
    street: asString(row.Nom_Vial) || asString(row.Tipo_vial),
    exteriorNumber: asString(row.Numero_ext),
    interiorNumber: asString(row.Numero_int),
    neighborhood: asString(row.Nomb_asent),
    postalCode: asString(row.Cod_Postal),
    locality: asString(row.Localidad),
    municipality: asString(row.Municipio),
    state: asString(row.Entidad),
    phone: asString(row.Telefono),
    email: asString(row.Correo_e),
    website: asString(row.WWW),
    lat: parseFloatOrNull(row.Latitud),
    lng: parseFloatOrNull(row.Longitud),
    rawPayload: { ...row },
  };
}

export function formatEstablishmentAddress(mapped: MappedEstablishment): string {
  return [
    mapped.street,
    mapped.exteriorNumber,
    mapped.neighborhood,
    mapped.postalCode,
    mapped.locality,
    mapped.municipality,
    mapped.state,
  ]
    .filter((part) => part && part.trim())
    .join(", ");
}
