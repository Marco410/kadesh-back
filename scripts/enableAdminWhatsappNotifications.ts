/**
 * Activa los avisos por WhatsApp (`User.whatsappNotifications`) de los admins que ya existen.
 * Los admins nuevos, o a quienes se les da el rol, ya quedan activos solos (`adminWhatsappDefaultHook`).
 *
 *   yarn whatsapp:admins-on               # solo reporta (base de config/.env.dev)
 *   yarn whatsapp:admins-on --apply       # aplica
 *   yarn whatsapp:admins-on:prod --apply  # contra config/.env.prod
 *
 * Solo toca a los admins. También avisa quién no tiene un teléfono que sirva: sin teléfono el
 * aviso no sale aunque esté activo. Se puede correr varias veces.
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { Role } from "../models/Role/constants";
import { normalizeMxPhone } from "../utils/pet/phone";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`,
    },
  },
});

/** Mismo criterio que `toWhatsappNumber` en utils/notifications/whatsapp.ts. */
function phoneWorks(raw: string | null | undefined) {
  if (!raw) return false;
  if (normalizeMxPhone(raw).ok) return true;
  return raw.replace(/\D/g, "").length >= 11;
}

function lastDigits(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits ? `…${digits.slice(-4)}` : "sin teléfono";
}

async function main() {
  const admins = await prisma.user.findMany({
    where: { roles: { some: { name: Role.ADMIN } } },
    select: { id: true, name: true, lastName: true, phone: true, whatsappNotifications: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${process.env.KADESH_ENV || "dev"} · ${admins.length} admin(s) · ${apply ? "APLICANDO" : "solo reporte"}`);
  for (const admin of admins) {
    const name = [admin.name, admin.lastName].filter(Boolean).join(" ") || admin.id;
    const phone = phoneWorks(admin.phone) ? lastDigits(admin.phone) : `${lastDigits(admin.phone)} (no sirve para WhatsApp)`;
    const state = admin.whatsappNotifications ? "ya activo" : apply ? "se activa" : "se activaría";
    console.log(`- ${name}: ${state} · ${phone}`);
  }

  const pending = admins.filter((admin) => !admin.whatsappNotifications).map((admin) => admin.id);
  if (apply && pending.length) {
    const result = await prisma.user.updateMany({
      where: { id: { in: pending } },
      data: { whatsappNotifications: true },
    });
    console.log(`Listo: ${result.count} admin(s) activados.`);
  } else if (!apply && pending.length) {
    console.log(`Corre con --apply para activar ${pending.length} admin(s).`);
  }

  const withoutPhone = admins.filter((admin) => !phoneWorks(admin.phone)).length;
  if (withoutPhone) {
    console.log(`Ojo: ${withoutPhone} admin(s) sin teléfono que sirva. Llénalo en su usuario o no les llega nada.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
