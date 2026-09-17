/* eslint-disable no-console */
/**
 * Carga masiva DENUE desde CSV (descarga de datos abiertos INEGI).
 *
 * Uso (humano):
 *   pnpm inegi:import:denue -- ./denue_sample.csv
 *   pnpm inegi:import:denue -- --latin1 ./denue_inegi_09.csv
 *
 * Probar primero con un recorte (miles de filas), no el nacional de varios GB.
 */
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "./keystone";
import { INEGI_SYNC_SOURCE } from "./models/Saas/Tech/Inegi/constants";
import { mapDenueCsvRow } from "./utils/inegi/mapEstablishment";
import type { DenueCsvRow, MappedEstablishment } from "./utils/inegi/types";

const BATCH_SIZE = 200;

function parseArgs(argv: string[]) {
  const latin1 = argv.includes("--latin1");
  const file = argv.find((arg) => !arg.startsWith("--"));
  return { latin1, file };
}

function getPrisma(context: unknown): any {
  return (context as { prisma: any }).prisma;
}

async function upsertActivities(
  prisma: any,
  batch: MappedEstablishment[],
): Promise<Map<string, string>> {
  const unique = new Map<string, string>();
  for (const row of batch) {
    if (row.scianCode && !unique.has(row.scianCode)) {
      unique.set(row.scianCode, row.scianName || row.scianCode);
    }
  }
  const idByCode = new Map<string, string>();
  for (const [scianCode, name] of unique) {
    const activity = await prisma.techInegiEconomicActivity.upsert({
      where: { scianCode },
      create: { scianCode, name },
      update: { name },
      select: { id: true, scianCode: true },
    });
    idByCode.set(activity.scianCode, activity.id);
  }
  return idByCode;
}

function toPrismaData(
  mapped: MappedEstablishment,
  activityId: string | undefined,
) {
  return {
    name: mapped.name,
    legalName: mapped.legalName,
    employeeStratum: mapped.employeeStratum,
    street: mapped.street,
    exteriorNumber: mapped.exteriorNumber,
    interiorNumber: mapped.interiorNumber,
    neighborhood: mapped.neighborhood,
    postalCode: mapped.postalCode,
    locality: mapped.locality,
    municipality: mapped.municipality,
    state: mapped.state,
    phone: mapped.phone,
    email: mapped.email,
    website: mapped.website,
    lat: mapped.lat,
    lng: mapped.lng,
    rawPayload: mapped.rawPayload,
    lastSyncedAt: new Date(),
    ...(activityId ? { economicActivityId: activityId } : {}),
  };
}

async function flushBatch(
  prisma: any,
  batch: MappedEstablishment[],
): Promise<{ created: number; updated: number }> {
  const activityIds = await upsertActivities(prisma, batch);
  let created = 0;
  let updated = 0;

  for (const mapped of batch) {
    const activityId = mapped.scianCode
      ? activityIds.get(mapped.scianCode)
      : undefined;
    const data = toPrismaData(mapped, activityId);
    const existing = await prisma.techInegiEstablishment.findUnique({
      where: { clee: mapped.clee },
      select: { id: true },
    });
    if (existing) {
      await prisma.techInegiEstablishment.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.techInegiEstablishment.create({
        data: { clee: mapped.clee, ...data },
      });
      created += 1;
    }
  }

  return { created, updated };
}

async function main() {
  const { latin1, file } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error(
      "Uso: pnpm inegi:import:denue -- [--latin1] <ruta.csv>",
    );
    process.exit(1);
  }

  const csvPath = path.resolve(file);
  if (!fs.existsSync(csvPath)) {
    console.error(`No existe el archivo: ${csvPath}`);
    process.exit(1);
  }

  const context = getContext(config, PrismaModule);
  const prisma = getPrisma(context);
  if (!prisma?.techInegiEstablishment) {
    console.error(
      "Prisma no tiene TechInegiEstablishment. Corre `yarn migrate` y reinicia.",
    );
    process.exit(1);
  }

  console.log(`Importando DENUE desde ${csvPath}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let read = 0;
  let batch: MappedEstablishment[] = [];

  const parser = fs
    .createReadStream(csvPath, { encoding: latin1 ? "latin1" : "utf8" })
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      }),
    );

  for await (const row of parser as AsyncIterable<DenueCsvRow>) {
    read += 1;
    const mapped = mapDenueCsvRow(row);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    batch.push(mapped);
    if (batch.length >= BATCH_SIZE) {
      const result = await flushBatch(prisma, batch);
      created += result.created;
      updated += result.updated;
      batch = [];
      if (read % 1000 === 0) {
        console.log(
          `… ${read} leídas, ${created} nuevas, ${updated} actualizadas, ${skipped} omitidas`,
        );
      }
    }
  }

  if (batch.length) {
    const result = await flushBatch(prisma, batch);
    created += result.created;
    updated += result.updated;
  }

  await context.sudo().query.TechInegiSyncLog.createOne({
    data: {
      success: true,
      message: `Import CSV ${path.basename(csvPath)}`,
      created,
      updated,
      alreadyInDb: updated,
      totalFetched: read,
      sourceMethod: INEGI_SYNC_SOURCE.BULK_IMPORT,
      searchParams: { file: csvPath, latin1 },
    },
  });

  console.log(
    `Listo: ${read} filas, ${created} nuevas, ${updated} actualizadas, ${skipped} omitidas`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
