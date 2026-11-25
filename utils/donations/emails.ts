import type { KeystoneContext } from "@keystone-6/core/types";
import { DONATION_STATUS } from "../../models/Pet/Donation/constants";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import {
  emailButton,
  emailCallout,
  emailGreeting,
  emailParagraph,
  escapeHtml,
  renderEmailLayout,
} from "../helpers/emailLayout";
import { sendEmail } from "../helpers/sendgrid";
import { notify } from "../notifications/notify";
import { petSiteUrl } from "../notifications/whatsapp";
import { publicDisplayName } from "../pet/publicProfile";
import { donationPrisma } from "./config";

/**
 * Thank-you email to the donor and the bell notice to the team, once a donation is paid. Never
 * throw (call with `void`). The copy never names the payment provider nor fees.
 */

const MONEY = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** «$75.00 MXN»: always with the currency. */
export function formatDonationMoney(cents: number): string {
  return `${MONEY.format((Number(cents) || 0) / 100)} MXN`;
}

export function patitasLabel(units: number): string {
  return `${units} ${units === 1 ? "patita" : "patitas"}`;
}

type DonationRow = {
  id: string;
  unitCount: number;
  amountCents: number;
  donorName: string | null;
  donorEmail: string | null;
  message: string | null;
  isAnonymous: boolean;
  hideFromWall: boolean;
  status: string;
};

async function loadDonation(context: KeystoneContext, donationId: string): Promise<DonationRow | null> {
  const row = await donationPrisma(context).donation.findUnique({
    where: { id: donationId },
    select: {
      id: true,
      unitCount: true,
      amountCents: true,
      donorName: true,
      donorEmail: true,
      message: true,
      isAnonymous: true,
      hideFromWall: true,
      status: true,
    },
  });
  if (row instanceof Error) throw row;
  return (row as DonationRow | null) ?? null;
}

export async function sendDonationThanksEmail(context: KeystoneContext, donationId: string): Promise<void> {
  try {
    const donation = await loadDonation(context, donationId);
    const to = donation?.donorEmail?.trim();
    if (!donation || !to || donation.status !== DONATION_STATUS.PAID) return;

    const firstName = donation.donorName?.trim().split(/\s+/)[0] || "";
    const patitas = patitasLabel(donation.unitCount);
    const wallName = donation.isAnonymous ? "Alguien anónimo" : publicDisplayName(donation.donorName);
    const body = `
      ${firstName ? emailGreeting(firstName) : ""}
      ${emailParagraph(`Recibimos tus <strong>${escapeHtml(patitas)}</strong> (${escapeHtml(formatDonationMoney(donation.amountCents))}). Con ellas Kadesh Pet sigue gratis para quien busca a su mascota: servidores, mapas, difusión y casos urgentes.`)}
      ${
        donation.message
          ? emailCallout(
              "pet",
              donation.hideFromWall
                ? `«${escapeHtml(donation.message)}»<br/><span style="font-size:13px;">Solo lo lee el equipo de Kadesh: pediste no aparecer en el muro.</span>`
                : `«${escapeHtml(donation.message)}»<br/><span style="font-size:13px;">— ${escapeHtml(wallName)}, en el muro de patitas</span>`,
            )
          : ""
      }
      ${emailParagraph("Publicamos a qué se destina cada peso en la página de donaciones.")}
      ${emailButton("pet", "Ver en qué se usan", petSiteUrl("/donaciones"))}`;

    await sendEmail({
      to,
      subject: `¡Gracias por tus ${patitas}!`,
      html: renderEmailLayout({
        brand: "pet",
        preheader: `Recibimos tus ${patitas}. Gracias por ayudar a que Kadesh Pet siga gratis.`,
        eyebrow: "Dame una patita",
        title: "¡Gracias por tu patita!",
        bodyHtml: body,
        footerNote: "Recibiste este correo porque hiciste una donación a Kadesh Pet.",
      }),
    });
  } catch (error) {
    console.error("[donations] thank-you email failed:", donationId, error);
  }
}

/** Bell notice to platform admins (like Easycoffee's notice to the creator). */
export async function notifyDonationReceived(context: KeystoneContext, donationId: string): Promise<void> {
  try {
    const donation = await loadDonation(context, donationId);
    if (!donation) return;
    const shown = donation.isAnonymous ? "Alguien anónimo" : publicDisplayName(donation.donorName);
    // The team sees who it was even off the wall; the note just says it is private.
    const who = donation.hideFromWall ? `${publicDisplayName(donation.donorName) || "Alguien"} (no sale en el muro)` : shown;
    await notify(context, {
      audience: "platform_admins",
      product: "pet",
      type: NOTIFICATION_TYPE.DONATION_ADMIN_RECEIVED,
      title: `Nueva donación: ${patitasLabel(donation.unitCount)} (${formatDonationMoney(donation.amountCents)})`,
      body: donation.message ? `${who}: «${donation.message.slice(0, 200)}»` : `${who} no dejó mensaje.`,
      entityType: "Donation",
      entityId: donation.id,
      url: petSiteUrl("/donaciones"),
    });
  } catch (error) {
    console.error("[donations] admin notice failed:", donationId, error);
  }
}
