/**
 * Corrige chats de WhatsApp importados con día y mes invertidos. El parser asumía DD/MM y un
 * export en MM/DD (teléfono en inglés de EE. UU.) quedaba con fechas futuras ("9 de diciembre"
 * en vez de 12 de septiembre), que tapaban todo en la Actividad de Operaciones.
 *
 *   yarn whatsapp:fix-import-dates             # solo reporta
 *   yarn whatsapp:fix-import-dates --apply     # corrige
 *
 * Por conversación importada (empresa + lead): se compara el orden guardado contra el de día y
 * mes invertidos; se voltea solo si así desaparecen las fechas futuras o el desorden (WhatsApp
 * exporta en orden, y los mensajes se insertaron en ese orden: el `id` lo conserva). Los
 * mensajes con día > 12 ya estaban bien (el parser viejo sí los volteaba) y no se tocan.
 *
 * Correr en el contenedor del back (consola de Railway): las fechas se armaron con la zona
 * horaria del servidor y se corrigen con la misma.
 */
import "../env";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`,
    },
  },
});

type Row = { id: string; createdAt: Date };

/** Misma fecha y hora con día y mes intercambiados; null si el día no puede ser mes. */
function swapped(date: Date): Date | null {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  if (day > 12 || day === month) return null;
  return new Date(
    date.getFullYear(),
    day - 1,
    month,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
}

function penalty(dates: Date[], now: number): number {
  let total = 0;
  let previous = -Infinity;
  for (const date of dates) {
    const time = date.getTime();
    if (time > now + FUTURE_SLACK_MS) total += 100;
    if (time < previous) total += 1;
    previous = time;
  }
  return total;
}

async function main() {
  console.log(`Base: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`);
  console.log(apply ? "Modo: APLICAR" : "Modo: solo reporte (usa --apply para escribir)");

  const rows = await prisma.techWhatsAppMessage.findMany({
    where: { source: "imported", createdAt: { not: null } },
    orderBy: { id: "asc" },
    select: { id: true, createdAt: true, companyId: true, businessLeadId: true },
  });

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.companyId}|${row.businessLeadId}`;
    groups.set(key, [...(groups.get(key) ?? []), { id: row.id, createdAt: row.createdAt as Date }]);
  }

  const now = Date.now();
  const fixes: Array<{ key: string; updates: Array<{ id: string; createdAt: Date }> }> = [];
  for (const [key, group] of groups) {
    const original = group.map((r) => r.createdAt);
    const flipped = group.map((r) => swapped(r.createdAt) ?? r.createdAt);
    if (penalty(flipped, now) >= penalty(original, now)) continue;
    const updates = group
      .map((r) => ({ id: r.id, next: swapped(r.createdAt) }))
      .filter((u): u is { id: string; next: Date } => u.next !== null)
      .map((u) => ({ id: u.id, createdAt: u.next }));
    if (updates.length) fixes.push({ key, updates });
  }

  const total = fixes.reduce((sum, f) => sum + f.updates.length, 0);
  console.log(`\nConversaciones importadas: ${groups.size} — a corregir: ${fixes.length} (${total} mensajes)`);
  for (const fix of fixes.slice(0, 20)) {
    const sample = fix.updates[0];
    const before = rows.find((r) => r.id === sample.id)?.createdAt as Date;
    console.log(
      `  - ${fix.key}: ${fix.updates.length} mensajes, p. ej. ${before.toISOString()} → ${sample.createdAt.toISOString()}`,
    );
  }
  if (fixes.length > 20) console.log(`  … y ${fixes.length - 20} más`);

  if (!apply) {
    console.log("\nSolo reporte. Corre con --apply para corregir.");
    return;
  }

  for (const fix of fixes) {
    await prisma.$transaction(
      fix.updates.map((u) =>
        prisma.techWhatsAppMessage.update({ where: { id: u.id }, data: { createdAt: u.createdAt } }),
      ),
    );
  }
  console.log(`\nListo: ${total} mensajes corregidos en ${fixes.length} conversaciones.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
