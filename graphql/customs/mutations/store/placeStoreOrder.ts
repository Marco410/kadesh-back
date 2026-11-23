import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import {
  STORE_ADDRESS_MAX,
  STORE_GUEST_MIN_PASSWORD,
  STORE_ORDER_CHANNEL,
  STORE_ORDER_EVENT,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_ATTEMPT_STATUS,
  STORE_PAYMENT_METHOD,
  STORE_PAYMENT_STATUS,
  STORE_STATEMENT_DESCRIPTOR_SUFFIX,
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
import { getStoreSettings, transferInstructions } from "../../../../utils/store/settings";

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
const CHECKOUT_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
/** A guest may get an order back by its key (and email) only this soon after placing it. */
const GUEST_REPLAY_MS = 15 * 60 * 1000;

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
    """
    Random key (16 to 64 letters, digits, - or _) made once per attempt to pay and sent again on
    every retry of that attempt. The same key twice answers the order already placed instead of
    placing another one. Make a new one after an answer with success false.
    """
    checkoutKey: String
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
  checkoutKey?: string | null;
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
    checkoutKey: string | null;
  },
): Promise<{ id: string; number: string } | "duplicate"> {
  const prisma = storePrisma(context);
  const { buyer, quote, address } = params;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = newStoreOrderNumber();
    const created = await prisma.storeOrder.create({
      data: {
        number,
        checkoutKey: params.checkoutKey,
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
      // Another request with the same checkout key placed the order first.
      if (isUniqueViolation(created) && params.checkoutKey && (await findOrderByCheckoutKey(context, params.checkoutKey))) {
        return "duplicate";
      }
      if (isUniqueViolation(created) && attempt < 4) continue;
      throw created;
    }
    return created as { id: string; number: string };
  }
  throw new Error("Could not generate an order number");
}

type PlacedOrder = {
  id: string;
  number: string;
  userId: string | null;
  email: string;
  guestCheckout: boolean;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalCents: number;
  stripePaymentIntentId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  checkoutKey: string | null;
};

async function findOrderByCheckoutKey(context: KeystoneContext, checkoutKey: string): Promise<PlacedOrder | null> {
  const order = await storePrisma(context).storeOrder.findUnique({
    where: { checkoutKey },
    select: {
      id: true,
      number: true,
      userId: true,
      email: true,
      guestCheckout: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      totalCents: true,
      stripePaymentIntentId: true,
      expiresAt: true,
      createdAt: true,
      checkoutKey: true,
    },
  });
  if (order instanceof Error) throw order;
  return (order as PlacedOrder | null) ?? null;
}

/**
 * The PaymentIntent of an order. Built the same way every time, so a second call with the same
 * Stripe idempotency key answers the very same intent instead of a new charge.
 */
function createOrderIntent(order: { id: string; number: string; totalCents: number }, buyer: Buyer) {
  return Stripe.paymentIntents.create(
    {
      amount: order.totalCents,
      currency: "mxn",
      payment_method_types: ["card"],
      ...(buyer.stripeCustomerId ? { customer: buyer.stripeCustomerId } : {}),
      receipt_email: buyer.email || undefined,
      description: `Pedido ${order.number} en la tienda de Kadesh Pet`,
      statement_descriptor_suffix: STORE_STATEMENT_DESCRIPTOR_SUFFIX,
      metadata: { kind: "store_order", orderId: order.id, orderNumber: order.number },
    },
    { idempotencyKey: `store-order-${order.id}` },
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Answers again an order already placed with this checkout key: the double click, the retry
 * after a timeout, three taps in the same second. Never places a second order nor a second charge.
 */
async function replayPlacedOrder(
  context: KeystoneContext,
  order: PlacedOrder,
  who: { sessionUserId: string | null; guestEmail: string | null },
) {
  const mine = who.sessionUserId
    ? order.userId === who.sessionUserId
    : Boolean(
        who.guestEmail &&
          order.guestCheckout &&
          order.email === who.guestEmail &&
          Date.now() - new Date(order.createdAt).getTime() < GUEST_REPLAY_MS,
      );
  const userId = order.userId;
  if (!mine || !userId) return fail("INVALID", "No pudimos crear tu pedido. Recarga la página e intenta de nuevo.");
  if (order.status !== STORE_ORDER_STATUS.OPEN) {
    return fail("INVALID", "Ese intento de compra ya no está activo. Revisa tu carrito e intenta de nuevo.");
  }

  let sessionToken: string | null = null;
  if (!who.sessionUserId && context.sessionStrategy) {
    const token = await context.sessionStrategy.start({ data: { listKey: "User", itemId: userId }, context });
    sessionToken = typeof token === "string" && token ? token : null;
  }
  const base = { ...EMPTY, success: true, orderNumber: order.number, totalCents: order.totalCents, sessionToken };

  if (order.paymentMethod !== STORE_PAYMENT_METHOD.CARD) {
    const settings = await getStoreSettings(context);
    return {
      ...base,
      message: "Pedido apartado. Falta tu transferencia.",
      transfer: transferInstructions(settings, { number: order.number, totalCents: order.totalCents, expiresAt: order.expiresAt ?? new Date() }),
    };
  }
  if (order.paymentStatus === STORE_PAYMENT_STATUS.PAID) {
    return { ...base, message: "Tu pago ya se había recibido. Tu pedido está pagado." };
  }

  // The first request may still be creating the intent: asking with the same idempotency key
  // answers that same intent (Stripe says 409 while the first call is in flight, so try twice).
  let clientSecret: string | null = null;
  for (let attempt = 0; attempt < 3 && !clientSecret; attempt += 1) {
    try {
      if (order.stripePaymentIntentId) {
        clientSecret = (await Stripe.paymentIntents.retrieve(order.stripePaymentIntentId)).client_secret ?? null;
      } else {
        const buyer = await loadBuyer(context, userId);
        if (!buyer) break;
        clientSecret = (await createOrderIntent(order, buyer)).client_secret ?? null;
      }
    } catch (error) {
      if (attempt === 2) console.error("[placeStoreOrder] replay could not read the intent:", order.number, error);
      await wait(800);
      const fresh = order.checkoutKey ? await findOrderByCheckoutKey(context, order.checkoutKey) : null;
      if (fresh?.stripePaymentIntentId) order = { ...order, stripePaymentIntentId: fresh.stripePaymentIntentId };
    }
  }
  if (!clientSecret) {
    return fail("PAYMENT_ERROR", "Tu pedido quedó creado. Ábrelo en Mis pedidos para pagarlo.", {
      orderNumber: order.number,
      totalCents: order.totalCents,
      sessionToken,
    });
  }
  return { ...base, message: "Pedido creado. Falta confirmar el pago.", stripeClientSecret: clientSecret };
}

const resolver = {
  placeStoreOrder: async (_root: unknown, { input }: { input: PlaceOrderInput }, context: KeystoneContext) => {
    if (!storeEnabled() && !isPlatformAdmin(context.session)) {
      return fail("STORE_CLOSED", "La tienda aún no está disponible.");
    }
    const sessionUserId = getSessionUserId(context.session);
    const rawKey = (input.checkoutKey ?? "").trim();
    if (rawKey && !CHECKOUT_KEY_PATTERN.test(rawKey)) return fail("INVALID", "Recarga la página e intenta de nuevo.");
    const checkoutKey = rawKey || null;
    const guestEmail = sessionUserId ? null : (input.guest?.email ?? "").trim().toLowerCase() || null;

    try {
      if (checkoutKey) {
        const placed = await findOrderByCheckoutKey(context, checkoutKey);
        if (placed) return await replayPlacedOrder(context, placed, { sessionUserId, guestEmail });
      }

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
        let created: { id: string };
        try {
          created = (await context.sudo().query.User.createOne({
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
        } catch (error) {
          // Two taps at once as a guest: the other request created the account and is placing
          // the order. Wait for it and answer that order.
          if (!checkoutKey) throw error;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            await wait(700);
            const placed = await findOrderByCheckoutKey(context, checkoutKey);
            if (placed) return await replayPlacedOrder(context, placed, { sessionUserId, guestEmail });
          }
          throw error;
        }
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
        const placed = await createOrderRow(context, {
          buyer,
          quote,
          address: address.data,
          paymentMethod,
          customerNote: (input.customerNote ?? "").trim().slice(0, 500),
          channel: input.channel === STORE_ORDER_CHANNEL.APP ? STORE_ORDER_CHANNEL.APP : STORE_ORDER_CHANNEL.WEB,
          guestCheckout: !sessionUserId,
          expiresAt,
          checkoutKey,
        });
        if (placed === "duplicate") {
          await releaseStoreStock(context, reserved);
          const existing = await findOrderByCheckoutKey(context, checkoutKey as string);
          if (!existing) return fail("INVALID", "No pudimos crear tu pedido. Intenta de nuevo.", { sessionToken });
          const replay = await replayPlacedOrder(context, existing, {
            sessionUserId: buyer.id,
            guestEmail: null,
          });
          return { ...replay, sessionToken: replay.sessionToken ?? sessionToken };
        }
        order = placed;
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
          const intent = await createOrderIntent({ ...order, totalCents: quote.totalCents }, buyer);
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
