import type { KeystoneContext } from "@keystone-6/core/types";
import {
  EMAIL_BRANDS,
  emailButton,
  emailCallout,
  emailGreeting,
  emailInfoTable,
  emailParagraph,
  escapeHtml,
  renderEmailLayout,
} from "../helpers/emailLayout";
import { sendEmail } from "../helpers/sendgrid";
import { petSiteUrl } from "../notifications/whatsapp";
import { storePrisma } from "./catalog";
import { getStoreSettings } from "./settings";

/**
 * Emails of a store order to its buyer. They never name who fulfils a product: the seller is
 * always Kadesh. Never throws (call with `void`).
 */

export type StoreOrderEmailKind =
  | "placed_transfer"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "transfer_rejected"
  | "refunded";

const MONEY = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatStoreMoney(cents: number | null | undefined): string {
  return MONEY.format((Number(cents) || 0) / 100);
}

/** Where the buyer sees an order: Mi cuenta → Pedidos. */
export function storeOrderUrl(orderNumber: string): string {
  return petSiteUrl(`/perfil?tab=pedidos&pedido=${encodeURIComponent(orderNumber)}`);
}

function formatDeadline(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

type OrderRow = {
  id: string;
  number: string;
  email: string | null;
  customerName: string | null;
  subtotalCents: number;
  couponCode: string | null;
  couponDiscountCents: number | null;
  shippingCents: number;
  totalCents: number;
  expiresAt: Date | null;
  cancelReason: string | null;
  items: Array<{
    name: string;
    variantTitle: string | null;
    quantity: number;
    totalCents: number;
    product: { slug: string | null; status: string } | null;
  }>;
};

/**
 * WhatsApp chat with the store, already written with the order, so the buyer only attaches the
 * proof of the transfer. Same text as the button of the order page in the landing.
 */
export function storeProofWhatsappUrl(phone: string, order: Pick<OrderRow, "number" | "totalCents" | "customerName" | "items">): string {
  const text = [
    `Hola, te mando el comprobante de mi transferencia del pedido ${order.number}.`,
    "",
    `Total: ${formatStoreMoney(order.totalCents)}`,
    `Concepto: ${order.number}`,
    ...(order.customerName ? [`A nombre de: ${order.customerName}`] : []),
    "",
    "Productos:",
    ...order.items.map((item) => `• ${item.quantity} × ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ""}`),
    "",
    "Adjunto la foto del comprobante.",
  ].join("\n");
  return `https://wa.me/52${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
}

export async function sendStoreOrderEmail(
  context: KeystoneContext,
  orderId: string,
  kind: StoreOrderEmailKind,
  extra: { carrier?: string | null; trackingCode?: string | null; trackingUrl?: string | null; note?: string | null } = {},
): Promise<void> {
  try {
    const order = (await storePrisma(context).storeOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        email: true,
        customerName: true,
        subtotalCents: true,
        couponCode: true,
        couponDiscountCents: true,
        shippingCents: true,
        totalCents: true,
        expiresAt: true,
        cancelReason: true,
        items: {
          select: {
            name: true,
            variantTitle: true,
            quantity: true,
            totalCents: true,
            product: { select: { slug: true, status: true } },
          },
          take: 50,
        },
      },
    })) as OrderRow | Error | null;
    if (order instanceof Error) throw order;
    const to = order?.email?.trim();
    if (!order || !to) return;

    const url = storeOrderUrl(order.number);
    const name = order.customerName?.trim().split(/\s+/)[0] || "ahí";
    const itemsTable = emailInfoTable([
      ...order.items.map((item): [string, string] => [
        `${escapeHtml(item.name)}${item.variantTitle ? ` (${escapeHtml(item.variantTitle)})` : ""} × ${item.quantity}`,
        escapeHtml(formatStoreMoney(item.totalCents)),
      ]),
      ...(Number(order.couponDiscountCents) > 0
        ? [[`Cupón ${escapeHtml(order.couponCode ?? "")}`, `−${escapeHtml(formatStoreMoney(order.couponDiscountCents))}`] as [string, string]]
        : []),
      ["Envío", order.shippingCents > 0 ? escapeHtml(formatStoreMoney(order.shippingCents)) : "Gratis"],
      ["Total", `<strong>${escapeHtml(formatStoreMoney(order.totalCents))}</strong>`],
    ]);

    let subject = "";
    let title = "";
    let preheader = "";
    let body = "";

    if (kind === "placed_transfer") {
      const settings = await getStoreSettings(context);
      subject = `Tu pedido ${order.number}: datos para la transferencia`;
      title = "Falta tu transferencia";
      const whatsapp = settings.supportWhatsapp;
      preheader = `Transfiere ${formatStoreMoney(order.totalCents)} y ${whatsapp ? "mándanos tu comprobante por WhatsApp" : "sube tu comprobante"}.`;
      body = `
        ${emailParagraph(`Apartamos tu pedido <strong>${escapeHtml(order.number)}</strong>. Para confirmarlo, transfiere el total y ${whatsapp ? "mándanos la foto de tu comprobante por WhatsApp" : "sube tu comprobante"}.`)}
        ${emailInfoTable([
          ["Monto", `<strong>${escapeHtml(formatStoreMoney(order.totalCents))}</strong>`],
          ["Banco", escapeHtml(settings.bankName || "—")],
          ["Beneficiario", escapeHtml(settings.bankBeneficiary || "—")],
          ["CLABE", escapeHtml(settings.bankClabe || "—")],
          ["Concepto", escapeHtml(order.number)],
        ])}
        ${settings.bankNote ? emailParagraph(escapeHtml(settings.bankNote)) : ""}
        ${order.expiresAt ? emailCallout("pet", `Tienes hasta el <strong>${escapeHtml(formatDeadline(order.expiresAt))}</strong>. Después el pedido se cancela solo.`) : ""}
        ${whatsapp ? emailButton("pet", "Mandar comprobante por WhatsApp", storeProofWhatsappUrl(whatsapp, order)) : emailButton("pet", "Subir mi comprobante", url)}
        ${itemsTable}`;
    } else if (kind === "paid") {
      subject = `Recibimos tu pago: pedido ${order.number}`;
      title = "¡Gracias por tu compra!";
      preheader = `Tu pedido ${order.number} está pagado y lo estamos preparando.`;
      body = `
        ${emailParagraph(`Recibimos el pago de tu pedido <strong>${escapeHtml(order.number)}</strong>. Ya lo estamos preparando y te avisamos en cuanto salga.`)}
        ${itemsTable}
        ${emailButton("pet", "Ver mi pedido", url)}`;
    } else if (kind === "shipped") {
      subject = `Tu pedido ${order.number} va en camino`;
      title = "Tu pedido va en camino";
      preheader = extra.trackingCode ? `Guía ${extra.trackingCode}` : "Ya salió hacia tu dirección.";
      const tracking: Array<[string, string]> = [];
      if (extra.carrier) tracking.push(["Paquetería", escapeHtml(extra.carrier)]);
      if (extra.trackingCode) tracking.push(["Guía", escapeHtml(extra.trackingCode)]);
      body = `
        ${emailParagraph(`Un paquete de tu pedido <strong>${escapeHtml(order.number)}</strong> ya salió hacia tu dirección.`)}
        ${tracking.length ? emailInfoTable(tracking) : ""}
        ${emailButton("pet", extra.trackingUrl ? "Rastrear mi paquete" : "Ver mi pedido", extra.trackingUrl || url)}`;
    } else if (kind === "delivered") {
      subject = `Entregamos tu pedido ${order.number}`;
      title = "Tu pedido llegó";
      preheader = "Cuéntanos qué te pareció.";
      // One button per product still for sale (up to five): the invitation to review.
      const reviewable = order.items
        .filter((item) => item.product?.slug && item.product.status === "active")
        .slice(0, 5);
      body = `
        ${emailParagraph(`Tu pedido <strong>${escapeHtml(order.number)}</strong> aparece como entregado. Si algo no llegó bien, responde a este correo y lo resolvemos.`)}
        ${
          reviewable.length > 0
            ? `${emailParagraph("¿Qué te parecieron? Tu reseña le ayuda a otras personas a elegir, y ganas huellitas por cada producto que reseñes.")}
        ${reviewable.map((item) => emailButton("pet", `Reseñar ${item.name.slice(0, 40)}`, petSiteUrl(`/tienda/${item.product!.slug}#resenas`))).join("")}`
            : ""
        }
        ${emailButton("pet", "Ver mi pedido", url)}`;
    } else if (kind === "transfer_rejected") {
      subject = `No pudimos confirmar tu transferencia: pedido ${order.number}`;
      title = "No pudimos confirmar tu transferencia";
      const whatsapp = (await getStoreSettings(context)).supportWhatsapp;
      preheader = whatsapp ? "Mándanos de nuevo tu comprobante." : "Sube de nuevo tu comprobante.";
      body = `
        ${emailParagraph(`Revisamos el comprobante de tu pedido <strong>${escapeHtml(order.number)}</strong> y no pudimos confirmar el pago.`)}
        ${extra.note ? emailCallout("pet", escapeHtml(extra.note)) : ""}
        ${order.expiresAt ? emailParagraph(`Puedes mandar otro hasta el <strong>${escapeHtml(formatDeadline(order.expiresAt))}</strong>.`) : ""}
        ${whatsapp ? emailButton("pet", "Mandar comprobante por WhatsApp", storeProofWhatsappUrl(whatsapp, order)) : emailButton("pet", "Subir otro comprobante", url)}`;
    } else if (kind === "refunded") {
      subject = `Reembolsamos tu pedido ${order.number}`;
      title = "Reembolsamos tu pedido";
      preheader = `${formatStoreMoney(order.totalCents)} de vuelta.`;
      body = `
        ${emailParagraph(`Cancelamos tu pedido <strong>${escapeHtml(order.number)}</strong> y te devolvimos <strong>${escapeHtml(formatStoreMoney(order.totalCents))}</strong>. Con tarjeta, el banco puede tardar de 5 a 10 días hábiles en mostrarlo.`)}
        ${extra.note ? emailCallout("pet", escapeHtml(extra.note)) : ""}
        ${emailButton("pet", "Ver mi pedido", url)}`;
    } else {
      subject = `Cancelamos tu pedido ${order.number}`;
      title = "Tu pedido se canceló";
      preheader = "No se hizo ningún cobro.";
      body = `
        ${emailParagraph(`El pedido <strong>${escapeHtml(order.number)}</strong> se canceló y no se hizo ningún cobro.`)}
        ${extra.note || order.cancelReason ? emailCallout("pet", escapeHtml(extra.note || order.cancelReason || "")) : ""}
        ${emailButton("pet", "Volver a la tienda", petSiteUrl("/tienda"))}`;
    }

    await sendEmail({
      to,
      subject,
      html: renderEmailLayout({
        brand: "pet",
        preheader,
        eyebrow: "Tienda",
        title,
        bodyHtml: `${emailGreeting(name)}${body}`,
        footerNote: `Recibiste este correo por tu pedido ${order.number} en la tienda de Kadesh Pet.`,
      }),
      fromName: EMAIL_BRANDS.pet.name,
    });
  } catch (error) {
    console.error("[store] could not send order email:", kind, orderId, error);
  }
}
