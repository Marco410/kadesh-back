/**
 * Una vez: vuelve a llenar `PetEvent.cityKey` en los eventos que lo perdieron.
 *
 * El `resolveInput` de PetEvent preguntaba `"city" in data`, pero en Keystone `resolvedData` trae
 * todas las llaves (las que no vienen en el cambio valen `undefined`). Así, cualquier update que
 * no mandara `city` (aprobar un evento, cancelarlo, editar la descripción) ponía `cityKey` en
 * null, y el evento dejaba de salir en /eventos/en/<estado>/<municipio> y en los filtros por
 * municipio. `cityKey` sale solo de `city`, así que se recalcula sin geocodificar.
 *
 *   pnpm events:backfill-city-keys              # solo cuenta y muestra lo que cambiaría
 *   pnpm events:backfill-city-keys --apply      # lo guarda
 *   pnpm events:backfill-city-keys:prod --apply # contra producción (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { cityKey } from "../utils/geo/mexicoStates";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

async function main() {
  const events = (await (prisma as any).petEvent.findMany({
    where: { cityKey: null, city: { not: "" } },
    select: { id: true, slug: true, city: true },
  })) as Array<{ id: string; slug: string | null; city: string }>;

  const fixes = events
    .map((event) => ({ ...event, key: cityKey(event.city) }))
    .filter((event): event is typeof event & { key: string } => Boolean(event.key));

  console.log(`Eventos con municipio y sin cityKey: ${events.length} (se pueden llenar: ${fixes.length})`);
  for (const event of fixes.slice(0, 20)) console.log(`  ${event.slug ?? event.id}: "${event.city}" → ${event.key}`);
  if (fixes.length > 20) console.log(`  … y ${fixes.length - 20} más`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }
  let updated = 0;
  for (const event of fixes) {
    await (prisma as any).petEvent.update({ where: { id: event.id }, data: { cityKey: event.key } });
    updated += 1;
  }
  console.log(`Actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
