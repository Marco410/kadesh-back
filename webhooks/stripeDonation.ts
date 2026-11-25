import type { KeystoneContext } from "@keystone-6/core/types";
import { DONATION_PAYMENT_KIND, DONATION_STATUS } from "../models/Pet/Donation/constants";
import { bumpDonationsDataVersion, donationPrisma } from "../utils/donations/config";
import { notifyDonationReceived, sendDonationThanksEmail } from "../utils/donations/emails";

/**
 * Stripe events of «Dame una patita». A donation PaymentIntent carries
 * `metadata.kind = "donation"` and the donation id. Idempotent by state: each step is one
 * `updateMany ... where <previous state>`, so a repeated event never applies twice.
 */

type AnyObject = Record<string, any>;

function chargeIdOf(intent: AnyObject): string | null {
  const charge = intent.latest_charge;
  if (typeof charge === "string" && charge) return charge;
  return typeof charge?.id === "string" ? charge.id : null;
}

function isDonationIntent(intent: AnyObject | undefined): intent is AnyObject {
  return intent?.metadata?.kind === DONATION_PAYMENT_KIND && Boolean(intent.metadata.donationId);
}

/**
 * Marks the donation of a succeeded intent as paid, once: the webhook and `settleDonation` (the
 * landing asking right after paying) may both arrive; only the first one sends the emails.
 */
export async function markDonationPaid(context: KeystoneContext, intent: AnyObject): Promise<boolean> {
  if (!isDonationIntent(intent) || intent.status !== "succeeded") return false;
  const donationId = String(intent.metadata.donationId);
  const updated = await donationPrisma(context).donation.updateMany({
    where: { id: donationId, status: { in: [DONATION_STATUS.PENDING, DONATION_STATUS.FAILED] } },
    data: {
      status: DONATION_STATUS.PAID,
      paidAt: new Date(),
      stripePaymentIntentId: intent.id,
      stripeChargeId: chargeIdOf(intent),
      errorMessage: "",
    },
  });
  if (updated instanceof Error) throw updated;
  if (updated.count !== 1) return false;
  bumpDonationsDataVersion();
  void sendDonationThanksEmail(context, donationId);
  void notifyDonationReceived(context, donationId);
  return true;
}

/** `payment_intent.succeeded`: the donation counts from now on (wall, ranking, emails). */
export async function handleDonationPaymentIntentSucceeded(context: KeystoneContext, event: AnyObject): Promise<void> {
  await markDonationPaid(context, event.data?.object as AnyObject);
}

/** `payment_intent.payment_failed`: the card was declined. The person can try another one. */
export async function handleDonationPaymentIntentFailed(context: KeystoneContext, event: AnyObject): Promise<void> {
  const intent = event.data?.object as AnyObject;
  if (!isDonationIntent(intent)) return;
  const reason = String(intent.last_payment_error?.message ?? "El banco rechazó el cobro.").slice(0, 300);
  const updated = await donationPrisma(context).donation.updateMany({
    where: { id: String(intent.metadata.donationId), status: DONATION_STATUS.PENDING },
    data: { status: DONATION_STATUS.FAILED, errorMessage: reason },
  });
  if (updated instanceof Error) throw updated;
}

/**
 * `charge.refunded` for a donation (made on the Stripe dashboard). A full refund takes it out of
 * the wall and the ranking. Answers whether the charge was a donation, so other handlers skip it.
 */
export async function handleDonationChargeRefunded(context: KeystoneContext, charge: AnyObject): Promise<boolean> {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  const prisma = donationPrisma(context);
  const donation = await prisma.donation.findFirst({
    where: { OR: [{ stripeChargeId: charge.id }, ...(intentId ? [{ stripePaymentIntentId: intentId }] : [])] },
    select: { id: true, amountCents: true },
  });
  if (donation instanceof Error) throw donation;
  if (!donation) return charge.metadata?.kind === DONATION_PAYMENT_KIND;

  const refunded = Number(charge.amount_refunded) || 0;
  if (charge.refunded === true || refunded >= donation.amountCents) {
    const updated = await prisma.donation.updateMany({
      where: { id: donation.id, status: DONATION_STATUS.PAID },
      data: { status: DONATION_STATUS.REFUNDED },
    });
    if (updated instanceof Error) throw updated;
    if (updated.count === 1) bumpDonationsDataVersion();
  }
  return true;
}
