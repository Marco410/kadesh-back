import { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../../../../utils/intregrations/stripe";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { PLAN_FREQUENCY } from "../../../../models/Saas/SaasPlan/constants";

const typeDefs = `
  input StripePlanCheckInput {
    planId: ID!
    """Price ID a revisar. Si no se manda, se usa el guardado en el plan."""
    stripePriceId: String
    """Valores del borrador que se va a guardar. Si no se mandan, se comparan los guardados."""
    cost: Float
    currency: String
    frequency: String
  }

  type StripePlanCheckField {
    field: String!
    label: String!
    local: String
    stripe: String
    match: Boolean!
  }

  type StripePlanCheckResult {
    success: Boolean!
    message: String!
    allMatch: Boolean!
    checkedAt: String
    priceId: String
    priceActive: Boolean
    productId: String
    productName: String
    productActive: Boolean
    livemode: Boolean
    subscriptionsCount: Int
    fields: [StripePlanCheckField!]!
  }

  type Query {
    stripePlanCheck(input: StripePlanCheckInput!): StripePlanCheckResult!
  }
`;

const definition = `
  stripePlanCheck(input: StripePlanCheckInput!): StripePlanCheckResult!
`;

type StripePlanCheckInput = {
  planId: string;
  stripePriceId?: string | null;
  cost?: number | null;
  currency?: string | null;
  frequency?: string | null;
};

type CheckField = {
  field: string;
  label: string;
  local: string | null;
  stripe: string | null;
  match: boolean;
};

/** Frecuencia de Kadesh -> `recurring.interval` de Stripe. `once` no es recurrente. */
const INTERVAL_BY_FREQUENCY: Record<string, string | null> = {
  [PLAN_FREQUENCY.WEEKLY]: "week",
  [PLAN_FREQUENCY.MONTHLY]: "month",
  [PLAN_FREQUENCY.ANNUAL]: "year",
  [PLAN_FREQUENCY.ONCE]: null,
};

function fail(message: string): {
  success: boolean;
  message: string;
  allMatch: boolean;
  fields: CheckField[];
} {
  return { success: false, message, allMatch: false, fields: [] };
}

/** Monto en unidades mayores (799.5) a centavos de Stripe (79950). */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function formatAmount(minorUnits: number | null, currency: string | null) {
  if (minorUnits == null) return null;
  const value = (minorUnits / 100).toFixed(2);
  return currency ? `${value} ${currency.toUpperCase()}` : value;
}

const resolver = {
  stripePlanCheck: async (
    _root: unknown,
    { input }: { input: StripePlanCheckInput },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) {
      return fail("Solo operaciones puede verificar planes con Stripe.");
    }

    const plan = await context.sudo().query.SaasPlan.findOne({
      where: { id: input.planId },
      query:
        "id name cost currency frequency stripePriceId stripeProductId active",
    });

    if (!plan) return fail("No encontramos ese plan.");

    const priceId = (input.stripePriceId ?? plan.stripePriceId ?? "").trim();
    if (!priceId) {
      return fail(
        "Este plan no tiene un precio de Stripe ligado. Pega el ID del precio para poder verificarlo.",
      );
    }

    const localCost = input.cost ?? plan.cost ?? null;
    const localCurrency = (input.currency ?? plan.currency ?? "").trim();
    const localFrequency = (input.frequency ?? plan.frequency ?? "").trim();
    const localProductId = (plan.stripeProductId ?? "").trim();

    let price: any;
    try {
      price = await Stripe.prices.retrieve(priceId, { expand: ["product"] });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return fail(`Stripe no reconoció ese precio: ${message}`);
    }

    const product =
      price.product && typeof price.product === "object" ? price.product : null;
    const stripeProductId =
      product?.id ?? (typeof price.product === "string" ? price.product : null);

    const stripeInterval = price.recurring?.interval ?? null;
    const expectedInterval = INTERVAL_BY_FREQUENCY[localFrequency] ?? null;

    const fields: CheckField[] = [
      {
        field: "cost",
        label: "Monto",
        local: formatAmount(
          localCost == null ? null : toMinorUnits(localCost),
          localCurrency || price.currency,
        ),
        stripe: formatAmount(price.unit_amount ?? null, price.currency),
        match:
          localCost != null &&
          price.unit_amount != null &&
          toMinorUnits(localCost) === price.unit_amount,
      },
      {
        field: "currency",
        label: "Moneda",
        local: localCurrency ? localCurrency.toUpperCase() : null,
        stripe: price.currency ? String(price.currency).toUpperCase() : null,
        match:
          Boolean(localCurrency) &&
          localCurrency.toLowerCase() === String(price.currency).toLowerCase(),
      },
      {
        field: "frequency",
        label: "Frecuencia",
        local: localFrequency || null,
        stripe: stripeInterval
          ? `cada ${price.recurring?.interval_count ?? 1} ${stripeInterval}`
          : "pago único",
        match: expectedInterval === stripeInterval,
      },
      {
        field: "priceActive",
        label: "Precio activo en Stripe",
        local: plan.active ? "Plan activo" : "Plan apagado",
        stripe: price.active ? "Activo" : "Archivado",
        match: Boolean(price.active),
      },
      {
        field: "product",
        label: "Producto",
        local: localProductId || null,
        stripe: stripeProductId,
        match: Boolean(
          stripeProductId &&
            (!localProductId || localProductId === stripeProductId),
        ),
      },
    ];

    let subscriptionsCount: number | null = null;
    try {
      const subs = await Stripe.subscriptions.list({
        price: priceId,
        status: "active",
        limit: 100,
      });
      subscriptionsCount = subs.data?.length ?? 0;
    } catch {
      subscriptionsCount = null;
    }

    const allMatch = fields.every((f) => f.match);

    return {
      success: true,
      message: allMatch
        ? "Todo coincide con Stripe."
        : "Hay diferencias entre este plan y Stripe.",
      allMatch,
      checkedAt: new Date().toISOString(),
      priceId,
      priceActive: Boolean(price.active),
      productId: stripeProductId,
      productName: product?.name ?? null,
      productActive: product ? Boolean(product.active) : null,
      livemode: Boolean(price.livemode),
      subscriptionsCount,
      fields,
    };
  },
};

export default { typeDefs, definition, resolver };
