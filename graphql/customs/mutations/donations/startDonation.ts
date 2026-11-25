import { createHash } from "crypto";
import type { KeystoneContext } from "@keystone-6/core/types";
import {
  DONATION_MAX_UNITS,
  DONATION_MESSAGE_MAX,
  DONATION_NAME_MAX,
  DONATION_PAYMENT_KIND,
  DONATION_REPLAY_MS,
  DONATION_SOURCE_REF_MAX,
  DONATION_SOURCES,
  DONATION_STATEMENT_DESCRIPTOR_SUFFIX,
  DONATION_STATUS,
  DONATION_UNIT_PRICE_CENTS,
} from "../../../../models/Pet/Donation/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { requestIp } from "../../../../utils/activity/requestMeta";
import { donationPrisma, donationsEnabled } from "../../../../utils/donations/config";
import Stripe from "../../../../utils/intregrations/stripe";
import { verifyTurnstile } from "../../../../utils/security/turnstile";

/**
 * «Dame una patita»: starts a one-time donation and answers the client secret of its PaymentIntent,
 * which the landing confirms with Stripe Elements. The donation counts (wall, ranking, emails)
 * only when the webhook says it was paid (`webhooks/stripeDonation.ts`).
 *
 * Without a session it needs Turnstile and an email; with a session the email and the account
 * come from it. Called `startDonation` because Keystone already generates `createDonation` for the
 * list. Rate limited per IP (`donation_ip` in `utils/security/constants.ts`).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECKOUT_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
// Control characters (keeps line breaks and tabs out of names, line breaks allowed in messages).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const typeDefs = `
  input StartDonationInput {
    "Patitas (1 = $25 MXN), 1 to 400."
    unitCount: Int!
    donorName: String
    "Required without a session; ignored with one."
    donorEmail: String
    message: String
    isAnonymous: Boolean
    "Not on the wall nor the donor top (still counts in the summary). The message only reaches the team."
    hideFromWall: Boolean
    "Where the form was opened: header | animal | veterinary | blog | blog_post | home | donations_page | reunited | event | profile | footer | about | contact."
    source: String
    "Slug of the page (animal, veterinary, post, event)."
    sourceRef: String
    "Random key of this form; a retry with it answers the same donation instead of a new charge."
    checkoutKey: String
    turnstileToken: String
  }

  type StartDonationResult {
    success: Boolean!
    "INVALID | DONATIONS_CLOSED | PAYMENT_ERROR"
    code: String
    message: String!
    donationId: ID
    clientSecret: String
    amountCents: Int
  }

`;

const definition = `startDonation(input: StartDonationInput!): StartDonationResult!`;

type StartDonationInput = {
  unitCount: number;
  donorName?: string | null;
  donorEmail?: string | null;
  message?: string | null;
  isAnonymous?: boolean | null;
  hideFromWall?: boolean | null;
  source?: string | null;
  sourceRef?: string | null;
  checkoutKey?: string | null;
  turnstileToken?: string | null;
};

const EMPTY = { code: null, donationId: null, clientSecret: null, amountCents: null };

function fail(code: string, message: string) {
  return { ...EMPTY, success: false, code, message };
}

function cleanLine(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMessage(value: string | null | undefined): string {
  return (value ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DONATION_MESSAGE_MAX);
}

function emailKey(email: string): string {
  return `email:${createHash("sha256").update(email.toLowerCase()).digest("hex")}`;
}

function createIntent(donation: { id: string; amountCents: number; unitCount: number }, email: string) {
  return Stripe.paymentIntents.create(
    {
      amount: donation.amountCents,
      currency: "mxn",
      payment_method_types: ["card"],
      receipt_email: email || undefined,
      description: `Donación «Dame una patita» a Kadesh Pet (${donation.unitCount})`,
      statement_descriptor_suffix: DONATION_STATEMENT_DESCRIPTOR_SUFFIX,
      metadata: { kind: DONATION_PAYMENT_KIND, donationId: donation.id, units: String(donation.unitCount) },
    },
    { idempotencyKey: `donation-${donation.id}` },
  );
}

/** A retry of the same form (double tap, timeout): same donation, same intent, no second charge. */
async function replay(context: KeystoneContext, checkoutKey: string, email: string, unitCount: number) {
  const prisma = donationPrisma(context);
  const existing = await prisma.donation.findUnique({
    where: { checkoutKey },
    select: { id: true, amountCents: true, unitCount: true, donorEmail: true, status: true, stripePaymentIntentId: true, createdAt: true },
  });
  if (existing instanceof Error) throw existing;
  if (!existing) return null;
  const fresh = Date.now() - new Date(existing.createdAt).getTime() < DONATION_REPLAY_MS;
  if (!fresh || existing.donorEmail !== email || existing.unitCount !== unitCount || existing.status !== DONATION_STATUS.PENDING) {
    return fail("INVALID", "Recarga la página e intenta de nuevo.");
  }
  const intent = existing.stripePaymentIntentId
    ? await Stripe.paymentIntents.retrieve(existing.stripePaymentIntentId)
    : await createIntent(existing, email);
  if (!existing.stripePaymentIntentId) {
    await prisma.donation.updateMany({ where: { id: existing.id, stripePaymentIntentId: null }, data: { stripePaymentIntentId: intent.id } });
  }
  return {
    ...EMPTY,
    success: true,
    message: "Falta confirmar el pago.",
    donationId: existing.id,
    clientSecret: intent.client_secret ?? null,
    amountCents: existing.amountCents,
  };
}

const resolver = {
  startDonation: async (_root: unknown, { input }: { input: StartDonationInput }, context: KeystoneContext) => {
    if (!donationsEnabled() && !isPlatformAdmin(context.session as any)) {
      return fail("DONATIONS_CLOSED", "Las donaciones aún no están disponibles.");
    }

    const unitCount = Math.floor(Number(input?.unitCount));
    if (!Number.isFinite(unitCount) || unitCount < 1 || unitCount > DONATION_MAX_UNITS) {
      return fail("INVALID", `Elige de 1 a ${DONATION_MAX_UNITS} patitas.`);
    }
    const rawKey = (input.checkoutKey ?? "").trim();
    if (rawKey && !CHECKOUT_KEY_PATTERN.test(rawKey)) return fail("INVALID", "Recarga la página e intenta de nuevo.");
    const checkoutKey = rawKey || null;

    const hideFromWall = input.hideFromWall === true;
    const isAnonymous = !hideFromWall && input.isAnonymous === true;
    const message = cleanMessage(input.message);
    const source = (DONATION_SOURCES as readonly string[]).includes(input.source ?? "") ? (input.source as string) : "other";
    const sourceRef = cleanLine(input.sourceRef, DONATION_SOURCE_REF_MAX);

    try {
      const prisma = donationPrisma(context);
      const userId = getSessionUserId(context.session as any);
      let email = "";
      let donorName = cleanLine(input.donorName, DONATION_NAME_MAX);

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, lastName: true } });
        if (user instanceof Error) throw user;
        email = String(user?.email ?? "").trim().toLowerCase();
        if (!donorName) donorName = cleanLine([user?.name, user?.lastName].filter(Boolean).join(" "), DONATION_NAME_MAX);
      } else {
        email = (input.donorEmail ?? "").trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email) || email.length > 200) return fail("INVALID", "Escribe un correo válido para mandarte el recibo.");
      }
      // Off the wall or anonymous, the name is never shown: it is optional (just for the receipt).
      if (!isAnonymous && !hideFromWall && donorName.length < 2) {
        return fail("INVALID", "Escribe tu nombre o elige «Anónimo» o «No aparecer».");
      }

      if (!userId && !(await verifyTurnstile(input.turnstileToken, requestIp(context.req)))) {
        return fail("INVALID", "No pudimos comprobar que eres una persona. Recarga la página e intenta de nuevo.");
      }

      if (checkoutKey) {
        const replayed = await replay(context, checkoutKey, email, unitCount);
        if (replayed) return replayed;
      }

      const amountCents = unitCount * DONATION_UNIT_PRICE_CENTS;
      const donation = await prisma.donation.create({
        data: {
          unitCount,
          amountCents,
          currency: "mxn",
          donorName,
          donorEmail: email,
          donorKey: userId ? `user:${userId}` : emailKey(email),
          ...(userId ? { user: { connect: { id: userId } } } : {}),
          message,
          isAnonymous,
          hideFromWall,
          status: DONATION_STATUS.PENDING,
          checkoutKey,
          source,
          sourceRef,
        },
        select: { id: true, amountCents: true, unitCount: true },
      });
      if (donation instanceof Error) throw donation;

      let clientSecret: string | null = null;
      try {
        const intent = await createIntent(donation, email);
        clientSecret = intent.client_secret ?? null;
        const saved = await prisma.donation.update({ where: { id: donation.id }, data: { stripePaymentIntentId: intent.id } });
        if (saved instanceof Error) throw saved;
      } catch (error) {
        console.error("[startDonation] intent failed:", donation.id, error);
        await prisma.donation.update({
          where: { id: donation.id },
          data: { status: DONATION_STATUS.FAILED, errorMessage: "No se pudo crear el cobro." },
        });
        return fail("PAYMENT_ERROR", "No pudimos preparar el pago. Intenta de nuevo en un momento.");
      }

      return {
        ...EMPTY,
        success: true,
        message: "Falta confirmar el pago.",
        donationId: donation.id,
        clientSecret,
        amountCents,
      };
    } catch (error) {
      console.error("[startDonation]", error);
      return fail("INVALID", "No pudimos preparar tu donación. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
