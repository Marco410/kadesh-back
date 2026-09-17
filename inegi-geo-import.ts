/* eslint-disable no-console */
/**
 * Carga Marco Geoestadístico desde GeoJSON (el humano convierte el shapefile
 * con QGIS u ogr2ogr). Sin PostGIS.
 *
 *   pnpm inegi:import:geo -- --level=municipio ./municipios.geojson
 */
import fs from "fs";
import path from "path";
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "./keystone";
import {
  INEGI_GEO_BOUNDARY_LEVEL,
  type InegiGeoBoundaryLevel,
} from "./models/Saas/Tech/Inegi/constants";

type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

type Feature = {
  type: string;
  properties?: Record<string, unknown>;
  geometry?: GeoJsonGeometry | null;
};

type FeatureCollection = {
  type: string;
  features?: Feature[];
};

const LEVELS = new Set<string>(Object.values(INEGI_GEO_BOUNDARY_LEVEL));

function parseArgs(argv: string[]) {
  let level: InegiGeoBoundaryLevel = INEGI_GEO_BOUNDARY_LEVEL.MUNICIPIO;
  let file: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--level=")) {
      const value = arg.slice("--level=".length);
      if (!LEVELS.has(value)) {
        throw new Error(`level inválido: ${value}`);
      }
      level = value as InegiGeoBoundaryLevel;
    } else if (!arg.startsWith("--")) {
      file = arg;
    }
  }
  return { level, file };
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function pickGeoCode(
  level: InegiGeoBoundaryLevel,
  props: Record<string, unknown>,
): { geoCode: string; name: string; parentCode: string | null } {
  const name =
    asString(props.NOMGEO) ||
    asString(props.NOM_ENT) ||
    asString(props.NOM_MUN) ||
    asString(props.NOM_LOC) ||
    asString(props.name);
  const ent = asString(props.CVE_ENT).padStart(2, "0");
  const mun = asString(props.CVE_MUN).padStart(3, "0");
  const loc = asString(props.CVE_LOC);
  const cvegeo = asString(props.CVEGEO);

  if (level === INEGI_GEO_BOUNDARY_LEVEL.ESTADO) {
    return { geoCode: cvegeo || ent, name, parentCode: null };
  }
  if (level === INEGI_GEO_BOUNDARY_LEVEL.MUNICIPIO) {
    return {
      geoCode: cvegeo || `${ent}${mun}`,
      name,
      parentCode: ent || null,
    };
  }
  return {
    geoCode: cvegeo || `${ent}${mun}${loc}`,
    name,
    parentCode: `${ent}${mun}` || null,
  };
}

function cacheKey(level: string, geoCode: string) {
  return `${level}:${geoCode}`;
}

async function main() {
  const { level, file } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error(
      "Uso: pnpm inegi:import:geo -- --level=estado|municipio|localidad <archivo.geojson>",
    );
    process.exit(1);
  }

  const jsonPath = path.resolve(file);
  if (!fs.existsSync(jsonPath)) {
    console.error(`No existe el archivo: ${jsonPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as FeatureCollection;
  const features = raw.features ?? [];
  if (!features.length) {
    console.error("El GeoJSON no trae features");
    process.exit(1);
  }

  const context = getContext(config, PrismaModule);
  const prisma = (context as unknown as { prisma: any }).prisma;
  if (!prisma?.techInegiGeoBoundary) {
    console.error(
      "Prisma no tiene TechInegiGeoBoundary. Corre `yarn migrate` y reinicia.",
    );
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const feature of features) {
    const props = feature.properties ?? {};
    const { geoCode, name, parentCode } = pickGeoCode(level, props);
    if (!geoCode || !name) {
      skipped += 1;
      continue;
    }
    const key = cacheKey(level, geoCode);
    const data = {
      level,
      geoCode,
      name,
      parentCode,
      geometry: feature.geometry ?? null,
    };
    const existing = await prisma.techInegiGeoBoundary.findUnique({
      where: { cacheKey: key },
      select: { id: true },
    });
    if (existing) {
      await prisma.techInegiGeoBoundary.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.techInegiGeoBoundary.create({
        data: { cacheKey: key, ...data },
      });
      created += 1;
    }
  }

  console.log(
    `Listo geo (${level}): ${created} nuevos, ${updated} actualizados, ${skipped} omitidos`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
