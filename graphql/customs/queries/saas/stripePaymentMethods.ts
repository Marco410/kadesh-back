import { KeystoneContext } from "@keystone-6/core/types";
import Stripe from "../../../../utils/intregrations/stripe";

const typeDefs = `
  type StripeCard {
    brand: String
    country: String
    exp_month: Int
    exp_year: Int
    last4: String
  }

  type StripePaymentMethod {
    id: String
    object: String
    customer: String
    type: String
    card: StripeCard
    created: Int
    livemode: Boolean
    metadata: JSON
  }

  type StripePaymentMethodsData {
    data: [StripePaymentMethod]
  }

  type StripePaymentMethodsType {
    message: String,
    success: Boolean,
    data: StripePaymentMethodsData
  }

  type Query {
    StripePaymentMethods(email: String!): StripePaymentMethodsType
  }
`;

const definition = `
  StripePaymentMethods(email: String!): StripePaymentMethodsType
`;

const resolver = {
  StripePaymentMethods: async (
    _root: unknown,
    { email }: { email: string },
    context: KeystoneContext
  ) => {
    const user = await context.query.User.findOne({
      where: { email },
      query: "id name stripeCustomerId",
    });

    const stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId) {
      return {
        message: "Missing stripe customer id",
        success: false,
        data: { data: [] },
      };
    }

    try {
      const paymentMethods = await Stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
      });

      return {
        message: "",
        success: true,
        data: {
          data: paymentMethods.data,
        },
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        message,
        success: false,
        data: { data: [] },
      };
    }
  },
};

export default { typeDefs, definition, resolver };
