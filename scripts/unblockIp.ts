/**
 * Salida de emergencia (fase 6.5): desbloquea una IP sin pasar por GraphQL, por si alguien de
 * Kadesh quedó bloqueado y ya no puede entrar a Operaciones.
 *
 *   pnpm security:unblock 187.192.209.183
 *   pnpm security:unblock --list          # ver las IPs bloqueadas
 *
 * El back vuelve a leer la lista en menos de un minuto (caché de `utils/security/blockedIps.ts`).
 * Con `KADESH_ENV=prod` usa la base de producción.
 */
import "../env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

async function main() {
  const db = prisma as any;
  if (process.argv.includes("--list")) {
    const rows = await db.blockedIp.findMany({ orderBy: { createdAt: "desc" } });
    if (rows.length === 0) console.log("No hay IPs bloqueadas.");
    for (const row of rows) {
      console.log(`${row.ip}\t${row.expiresAt ? `hasta ${row.expiresAt.toISOString()}` : "indefinido"}\t${row.reason ?? ""}`);
    }
    return;
  }
  const ip = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.trim();
  if (!ip) {
    console.error("Uso: pnpm security:unblock <ip>   |   pnpm security:unblock --list");
    process.exitCode = 1;
    return;
  }
  const { count } = await db.blockedIp.deleteMany({ where: { ip } });
  console.log(count ? `IP ${ip} desbloqueada.` : `La IP ${ip} no estaba bloqueada.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
