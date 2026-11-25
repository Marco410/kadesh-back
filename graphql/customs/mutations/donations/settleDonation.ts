import type { KeystoneContext } from "@keystone-6/core/types";
import { DONATION_STATUS } from "../../../../models/Pet/Donation/constants";
import { donationPrisma } from "../../../../utils/donations/config";
import Stripe from "../../../../utils/intregrations/stripe";
import { markDonationPaid } from "../../../../webhooks/stripeDonation";

/**
 * Right after the card is confirmed, the landing asks whether the donation already went through,
 * so it counts without waiting for the webhook (it can arrive seconds later, or never locally
 * without `stripe listen`). Same idea as `settleStoreCardPayment` in the store.
 *
 * Safe to call by anyone: it only reads the donation's own PaymentIntent from Stripe and marks it
 * paid when Stripe says so. Answers `true` when the donation is paid (now or before).
 * Rate limited with `donation_ip` (`utils/security/constants.ts`).
 */

const typeDefs = ``;

const definition = `settleDonation(donationId: ID!): Boolean!`;

const resolver = {
  settleDonation: async (_root: unknown, { donationId }: { donationId: string }, context: KeystoneContext) => {
    try {
      const donation = await donationPrisma(context).donation.findUnique({
        where: { id: String(donationId ?? "") },
        select: { id: true, status: true, stripePaymentIntentId: true },
      });
      if (donation instanceof Error) throw donation;
      if (!donation) return false;
      if (donation.status === DONATION_STATUS.PAID) return true;
      if (donation.status !== DONATION_STATUS.PENDING || !donation.stripePaymentIntentId) return false;

      const intent = await Stripe.paymentIntents.retrieve(donation.stripePaymentIntentId);
      // The intent must be this donation's (never trust an id from the client alone).
      if (String(intent.metadata?.donationId ?? "") !== donation.id) return false;
      if (intent.status !== "succeeded") return false;
      await markDonationPaid(context, intent as any);
      return true;
    } catch (error) {
      console.error("[settleDonation]", donationId, error);
      return false;
    }
  },
};

export default { typeDefs, definition, resolver };
