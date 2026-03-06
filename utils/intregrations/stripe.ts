const Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export default Stripe;