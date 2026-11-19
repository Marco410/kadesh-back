import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import {
  STORE_ADDRESS_MAX,
  STORE_GUEST_MIN_PASSWORD,
  STORE_ORDER_CHANNEL,
  STORE_ORDER_EVENT,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { requestIp } from "../../../../utils/activity/requestMeta";
import { PRODUCT } from "../../../../utils/constants/product";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import Stripe from "../../../../utils/intregrations/stripe";
import { normalizeMxPhone } from "../../../../utils/pet/phone";
import { verifyTurnstile } from "../../../../utils/security/turnstile";
import { STORE_ADDRESS_TYPEDEFS, validateStoreAddress, type StoreAddressData, type StoreAddressInput } from "../../../../utils/store/address";
import { storePrisma } from "../../../../utils/store/catalog";
import { storeEnabled } from "../../../../utils/store/config";
import { reserveCoupon } from "../../../../utils/store/coupons";
import { sendStoreOrderEmail } from "../../../../utils/store/emails";
import {
  addStoreOrderEvent,
  cancelUnpaidStoreOrder,
  isUniqueViolation,
  newStoreOrderNumber,
  releaseStoreStock,
  reserveStoreStock,
} from "../../../../utils/store/orders";
import { CART_QUOTE_TYPEDEFS, publicQuote, quoteCart, type CartItemInput, type CartQuote } from "../../../../utils/store/pricing";
import { transferInstructions } from "../../../../utils/store/settings";

/**
 * Places an order. Called `placeStoreOrder` because Keystone already generates `createStoreOrder`
 * for the list.
 *
 * The browser sends variants, quantities, the address and how it wants to pay. Prices, shipping
 * and the total are computed here; `expectedTotalCents` is only what the person saw, and if it no
 * longer matches nothing is charged and the fresh quote goes back.
 *
 * Without a session it creates the account with the email and password of the checkout form and
 * answers its session token: the person buys and ends up signed in.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const typeDefs = `
  ${CART_QUOTE_TYPEDEFS}
  ${STORE_ADDRESS_TYPEDEFS}

  input StoreGuestInput {
    name: String!
    lastName: String
    email: String!
    "10 digits"
    phone: String!
    "The password of the account that is created with the order (8 characters or more)."
    password: String!
    turnstileToken: String
  }

  input StorePlaceOrderInput {
    items: [StoreCartItemInput!]!
    "stripe_card | bank_transfer"
    paymentMethod: String!
    address: StoreShippingAddressInput!
    "Keep the address in the account for next time."
    saveAddress: Boolean
    customerNote: String
    "Discount code typed in the cart. The order is not placed if it no longer applies."
    couponCode: String
    "The total the person saw (MXN cents). The order is not placed if it changed."
    expectedTotalCents: Int!
    "web (default) | app"
    channel: String
    "Only without a session."
    guest: StoreGuestInput
  }

  type StoreTransferInstructions {
    bankName: String!
    beneficiary: String!
    clabe: String!
    note: String
    "What to write as the concept of the transfer: the order number."
    reference: String!
    amountCents: Int!
    "ISO 8601: unpaid by then, the order cancels itself."
    expiresAt: String
  }

  type StorePlaceOrderResult {
    success: Boolean!
    message: String!
    "null | STORE_CLOSED | LOGIN_REQUIRED | EMAIL_EXISTS | INVALID | CART_CHANGED | PRICE_CHANGED | COUPON_INVALID | PAYMENT_UNAVAILABLE | PAYMENT_ERROR"
    code: String
    orderNumber: String
    totalCents: Int
    "Card: confirm this with Stripe Elements."
    stripeClientSecret: String
    "Guest checkout: session token of the account just created."
    sessionToken: String
    transfer: StoreTransferInstructions
    "Fresh quote when the cart or its total changed."
    quote: StoreCartQuote
  }
`;

const definition = `
  placeStoreOrder(input: StorePlaceOrderInput!): StorePlaceOrderResult!
`;

type GuestInput = {
  name: string;
  lastName?: string | null;
  email: string;
  phone: string;
  password: string;
  turnstileToken?: string | null;
};

type PlaceOrderInput = {
  items: CartItemInput[];
  paymentMethod: string;
  address: StoreAddressInput;
  saveAddress?: boolean | null;
  customerNote?: string | null;
  couponCode?: string | null;
  expectedTotalCents: number;
  channel?: string | null;
  guest?: GuestInput | null;
};

type Buyer = {
  id: string;
  email: string;
  name: string;
  phone: string;
  stripeCustomerId: string | null;
};

const EMPTY = {
  code: null,
  orderNumber: null,
  totalCents: null,
  stripeClientSecret: null,
  sessionToken: null,
  transfer: null,
  quote: null,
};

function fail(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { ...EMPTY, success: false, code, message, ...extra };
}

async function loadBuyer(context: KeystoneContext, userId: string): Promise<Buyer | null> {
  const user = await storePrisma(context).user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, lastName: true, phone: true, stripeCustomerId: true },
  });
  if (user instanceof Error) throw user;
  if (!user) return null;
  return {
    id: user.id,
    email: String(user.email ?? "").trim().toLowerCase(),
    name: [user.name, user.lastName].filter(Boolean).join(" ").trim(),
    phone: String(user.phone ?? ""),
    stripeCustomerId: user.stripeCustomerId || null,
  };
}

/** Checks the guest form. The account itself is only created once the cart is known to be fine. */
async function checkGuest(context: KeystoneContext, guest: GuestInput | null | undefined) {
  if (!guest) return fail("LOGIN_REQUIRED", "Inicia sesión o llena tus datos para comprar.");
  const name = (guest.name ?? "").trim();
  if (name.length < 2) return fail("INVALID", "Escribe tu nombre.");
  const email = (guest.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return fail("INVALID", "Escribe un correo válido.");
  const phone = normalizeMxPhone(guest.phone ?? "");
  if (!phone.ok) return fail("INVALID", "Tu teléfono debe tener 10 dígitos.");
  if ((guest.password ?? "").length < STORE_GUEST_MIN_PASSWORD) {
    return fail("INVALID", `Tu contraseña debe tener al menos ${STORE_GUEST_MIN_PASSWORD} caracteres.`);
  }
  if (!(await verifyTurnstile(guest.turnstileToken, requestIp(context.req)))) {
    return fail("INVALID", "No pudimos comprobar que eres una persona. Recarga la página e intenta de nuevo.");
  }
  const existing = await storePrisma(context).user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing instanceof Error) throw existing;
  if (existing) return fail("EMAIL_EXISTS", "Ya hay una cuenta con ese correo. Inicia sesión para terminar tu compra.");
  return { ok: true as const, name, lastName: (guest.lastName ?? "").trim(), email, phone: phone.digits, password: guest.password };
}

async function saveAddressFor(context: KeystoneContext, userId: string, address: StoreAddressData): Promise<void> {
  try {
    const prisma = storePrisma(context);
    const existing = await prisma.storeAddress.findMany({
      where: { userId },
      select: { id: true, street: true, exteriorNumber: true, postalCode: true, recipientName: true },
      take: STORE_ADDRESS_MAX,
    });
    if (existing instanceof Error) throw existing;
    const rows = existing as Array<{ street: string; exteriorNumber: string; postalCode: string; recipientName: string }>;
    const same = rows.some(
      (row) =>
        row.street === address.street &&
        row.exteriorNumber === address.exteriorNumber &&
        row.postalCode === address.postalCode &&
        row.recipientName === address.recipientName,
    );
    if (same || rows.length >= STORE_ADDRESS_MAX) return;
    const created = await prisma.storeAddress.create({
      data: { ...address, isDefault: rows.length === 0, user: { connect: { id: userId } } },
    });
    if (created instanceof Error) throw created;
  } catch (error) {
    console.error("[placeStoreOrder] could not save the address:", error);
  }
}

async function createOrderRow(
  context: KeystoneContext,
  params: {
    buyer: Buyer;
    quote: CartQuote;
    address: StoreAddressData;
    paymentMethod: string;
    customerNote: string;
    channel: string;
    guestCheckout: boolean;
    expiresAt: Date;
  },
): Promise<{ id: string; number: string }> {
  const prisma = storePrisma(context);
  const { buyer, quote, address } = params;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = newStoreOrderNumber();
    const created = await prisma.storeOrder.create({
      data: {
        number,
        user: { connect: { id: buyer.id } },
        customerName: buyer.name || address.recipientName,
        email: buyer.email,
        phone: buyer.phone || address.phone,
        channel: params.channel,
        guestCheckout: params.guestCheckout,
        unitsCount: quote.itemsCount,
        subtotalCents: quote.subtotalCents,
        couponCode: quote.couponApplied ? quote.couponCode : null,
        couponDiscountCents: quote.couponDiscountCents,
        shippingCents: quote.shippingCents,
        totalCents: quote.totalCents,
        costCents: quote.costCents,
        paymentMethod: params.paymentMethod,
        expiresAt: params.expiresAt,
        shipRecipientName: address.recipientName,
        shipPhone: address.phone,
        shipStreet: address.street,
        shipExteriorNumber: address.exteriorNumber,
        shipInteriorNumber: address.interiorNumber,
        shipNeighborhood: address.neighborhood,
        shipCity: address.city,
        shipStateCode: address.stateCode,
        shipPostalCode: address.postalCode,
        shipReferences: address.references,
        customerNote: params.customerNote,
        searchText: normalizeSearchText(
          [number, buyer.name, address.recipientName, buyer.email, buyer.phone, address.phone].filter(Boolean).join(" "),
        ),
        items: {
          create: quote.lines.map((line) => ({
            ...(line.productId ? { product: { connect: { id: line.productId } } } : {}),
            variant: { connect: { id: line.variantId } },
            name: line.name,
            variantTitle: line.variantTitle ?? "",
            sku: line.sku ?? "",
            source: line.source,
            externalId: line.externalId,
            dropiVariationId: line.dropiVariationId,
            dropiSupplierId: line.dropiSupplierId,
            unitPriceCents: line.unitPriceCents,
            unitCostCents: line.unitCostCents,
            discountCents: line.discountCents,
            quantity: line.quantity,
            totalCents: line.lineTotalCents,
            reservedQuantity: line.tracked ? line.quantity : 0,
          })),
        },
      },
      select: { id: true, number: true },
    });
    if (created instanceof Error) {
      if (isUniqueViolation(created) && attempt < 4) continue;
      throw created;
    }
    return created as { id: string; number: string };
  }
  throw new Error("Could not generate an order number");
}

const resolver = {
  placeStoreOrder: async (_root: unknown, { input }: { input: PlaceOrderInput }, context: KeystoneContext) => {
    if (!storeEnabled() && !isPlatformAdmin(context.session)) {
      return fail("STORE_CLOSED", "La tienda aún no está disponible.");
    }
    const sessionUserId = getSessionUserId(context.session);

    try {
      const paymentMethod = (input.paymentMethod ?? "").trim();
      const address = validateStoreAddress(input.address);
      if (!address.ok) return fail("INVALID", address.message);

      // Guest form first (cheap), account creation last.
      const guest = sessionUserId ? null : await checkGuest(context, input.guest);
      if (guest && !("ok" in guest)) return guest;

      const couponCode = (input.couponCode ?? "").trim() || null;
      const quote = await quoteCart(context, input.items, { couponCode, userId: sessionUserId });
      if (!quote.canCheckout) {
        return fail("CART_CHANGED", quote.messages[0] ?? "Tu carrito cambió. Revísalo antes de pagar.", { quote: publicQuote(quote) });
      }
      if (couponCode && !quote.couponApplied) {
        return fail("COUPON_INVALID", quote.couponMessage ?? "Ese cupón ya no aplica.", { quote: publicQuote(quote) });
      }
      if (Math.floor(Number(input.expectedTotalCents)) !== quote.totalCents) {
        return fail("PRICE_CHANGED", "El total de tu carrito cambió. Revísalo antes de pagar.", { quote: publicQuote(quote) });
      }
      if (!quote.paymentMethods.includes(paymentMethod)) {
        return fail("PAYMENT_UNAVAILABLE", "Esa forma de pago no está disponible. Elige otra.", { quote: publicQuote(quote) });
      }

      // The account of a guest is created only now, with the cart known to be fine.
      let buyer: Buyer | null;
      let sessionToken: string | null = null;
      if (sessionUserId) {
        buyer = await loadBuyer(context, sessionUserId);
      } else {
        const form = guest as Extract<typeof guest, { ok: true }>;
        const created = (await context.sudo().query.User.createOne({
          data: {
            name: form.name,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            password: form.password,
            product: PRODUCT.PET,
          },
          query: "id",
        })) as { id: string };
        buyer = await loadBuyer(context, created.id);
        if (context.sessionStrategy) {
          const token = await context.sessionStrategy.start({ data: { listKey: "User", itemId: created.id }, context });
          sessionToken = typeof token === "string" && token ? token : null;
        }
      }
      if (!buyer) return fail("LOGIN_REQUIRED", "Inicia sesión para comprar.", { sessionToken });

      const reserved = await reserveStoreStock(context, quote.lines);
      if (!reserved) {
        const fresh = await quoteCart(context, input.items, { couponCode, userId: buyer.id });
        return fail("CART_CHANGED", fresh.messages[0] ?? "Un producto de tu carrito se agotó.", {
          quote: publicQuote(fresh),
          sessionToken,
        });
      }

      const card = paymentMethod === STORE_PAYMENT_METHOD.CARD;
      const expiresAt = new Date(
        Date.now() + (card ? quote.settings.cardExpiryMinutes * 60_000 : quote.settings.transferExpiryHours * 3_600_000),
      );

      let order: { id: string; number: string };
      try {
        order = await createOrderRow(context, {
          buyer,
          quote,
          address: address.data,
          paymentMethod,
          customerNote: (input.customerNote ?? "").trim().slice(0, 500),
          channel: input.channel === STORE_ORDER_CHANNEL.APP ? STORE_ORDER_CHANNEL.APP : STORE_ORDER_CHANNEL.WEB,
          guestCheckout: !sessionUserId,
          expiresAt,
        });
      } catch (error) {
        await releaseStoreStock(context, reserved);
        throw error;
      }

      // One use of the coupon, taken atomically: if someone else just took the last one, the order
      // does not go on with a discount it should not have.
      if (quote.couponId) {
        const reservedCoupon = await reserveCoupon(context, {
          couponId: quote.couponId,
          orderId: order.id,
          userId: buyer.id,
          discountCents: quote.couponDiscountCents,
        });
        if (!reservedCoupon) {
          await cancelUnpaidStoreOrder(context, order.id, { reason: "El cupón se agotó antes de terminar la compra." });
          const fresh = await quoteCart(context, input.items, { userId: buyer.id });
          return fail("COUPON_INVALID", "Ese cupón se acaba de agotar.", { quote: publicQuote(fresh), sessionToken });
        }
      }

      await addStoreOrderEvent(context, {
        orderId: order.id,
        type: STORE_ORDER_EVENT.PLACED,
        actorId: buyer.id,
        message: "Hiciste tu pedido.",
        isPublic: true,
      });

      const prisma = storePrisma(context);
      let stripeClientSecret: string | null = null;
      if (card) {
        try {
          const intent = await Stripe.paymentIntents.create(
            {
              amount: quote.totalCents,
              currency: "mxn",
              payment_method_types: ["card"],
              ...(buyer.stripeCustomerId ? { customer: buyer.stripeCustomerId } : {}),
              receipt_email: buyer.email || undefined,
              description: `Pedido ${order.number} en la tienda de Kadesh Pet`,
              metadata: { kind: "store_order", orderId: order.id, orderNumber: order.number },
            },
            { idempotencyKey: `store-order-${order.id}` },
          );
          stripeClientSecret = intent.client_secret ?? null;
          const linked = await prisma.storeOrder.update({
            where: { id: order.id },
            data: { stripePaymentIntentId: intent.id },
          });
          if (linked instanceof Error) throw linked;
          const payment = await prisma.storePayment.create({
            data: {
              order: { connect: { id: order.id } },
              provider: STORE_PAYMENT_METHOD.CARD,
              amountCents: quote.totalCents,
              status: STORE_PAYMENT_ATTEMPT_STATUS.PENDING,
              stripePaymentIntentId: intent.id,
            },
          });
          if (payment instanceof Error) throw payment;
        } catch (error) {
          console.error("[placeStoreOrder] Stripe failed:", order.number, error);
          await cancelUnpaidStoreOrder(context, order.id, { reason: "No se pudo iniciar el cobro con tarjeta." });
          return fail("PAYMENT_ERROR", "No pudimos iniciar el cobro con tarjeta. Intenta de nuevo o elige transferencia.", {
            sessionToken,
          });
        }
      } else {
        const payment = await prisma.storePayment.create({
          data: {
            order: { connect: { id: order.id } },
            provider: STORE_PAYMENT_METHOD.TRANSFER,
            amountCents: quote.totalCents,
            status: STORE_PAYMENT_ATTEMPT_STATUS.PENDING,
          },
        });
        if (payment instanceof Error) throw payment;
        void sendStoreOrderEmail(context, order.id, "placed_transfer");
      }

      if (input.saveAddress !== false) await saveAddressFor(context, buyer.id, address.data);

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_STORE_ORDER_PLACED,
        actorId: buyer.id,
        summary: `Hizo el pedido ${order.number}`,
        entityType: "StoreOrder",
        entityId: order.id,
        metadata: { totalCents: quote.totalCents, items: quote.itemsCount, paymentMethod, guest: !sessionUserId, coupon: quote.couponApplied },
      });

      return {
        ...EMPTY,
        success: true,
        message: card ? "Pedido creado. Falta confirmar el pago." : "Pedido apartado. Falta tu transferencia.",
        orderNumber: order.number,
        totalCents: quote.totalCents,
        stripeClientSecret,
        sessionToken,
        transfer: card ? null : transferInstructions(quote.settings, { number: order.number, totalCents: quote.totalCents, expiresAt }),
      };
    } catch (error) {
      console.error("[placeStoreOrder]", error);
      return fail("INVALID", "No pudimos crear tu pedido. Intenta de nuevo.");
    }
  },
};

export default { typeDefs, definition, resolver };
