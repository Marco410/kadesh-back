import { list } from "@keystone-6/core";
import {
  text,
  integer,
  timestamp,
  relationship,
  checkbox,
  json,
} from "@keystone-6/core/fields";
import { saasSubscriptionLogAccess } from "./SaasSubscriptionLog.access";

export default list({
  access: saasSubscriptionLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "success",
        "step",
        "emailMasked",
        "company",
        "message",
      ],
    },
  },
  fields: {
    user: relationship({
      ref: "User.saasSubscriptionLogs",
      many: false,
      ui: { description: "Usuario que intentó contratar (si se resolvió por email)" },
    }),
    company: relationship({
      ref: "SaasCompany.saasSubscriptionLogs",
      many: false,
      ui: { description: "Empresa del usuario" },
    }),
    plan: relationship({
      ref: "SaasPlan.saasSubscriptionLogs",
      many: false,
      ui: { description: "Plan solicitado (si se resolvió)" },
    }),
    createdSubscription: relationship({
      ref: "SaasCompanySubscription.saasSubscriptionLogs",
      many: false,
      ui: { description: "Registro SaasCompanySubscription creado en un intento exitoso" },
    }),
    success: checkbox({
      defaultValue: false,
      ui: { description: "Si la mutación devolvió success: true" },
    }),
    /** Código corto para filtrar (ej. TOTAL_MISMATCH, SUCCESS) */
    step: text({
      isIndexed: true,
      ui: { description: "Paso / motivo (SAAS_SUBSCRIPTION_LOG_STEP)" },
    }),
    /** Mismo mensaje que recibió el cliente en GraphQL */
    message: text({
      ui: { displayMode: "textarea", description: "Mensaje devuelto al cliente" },
    }),
    /** Copia del payload de respuesta (success, message, subscriptionId, paymentId, extras) */
    responseSnapshot: json({
      ui: { description: "Snapshot del resultado devuelto al cliente" },
    }),
    emailMasked: text({
      ui: { description: "Email del intento (enmascarado)" },
    }),
    planIdRequested: text({
      ui: { description: "planId enviado en el input" },
    }),
    totalSubmitted: text({
      ui: { description: "total enviado por el cliente" },
    }),
    paymentMethodIdSubmitted: text({
      ui: { description: "ID interno del método de pago" },
    }),
    paymentTypeSubmitted: text({
      ui: { description: "paymentType del input" },
    }),
    durationMs: integer({
      db: { isNullable: true },
      ui: { description: "Duración del intento en ms" },
    }),
    stripeCustomerId: text({
      db: { isNullable: true },
      ui: { description: "Stripe customer id al finalizar (si aplica)" },
    }),
    stripeSubscriptionId: text({
      db: { isNullable: true },
      ui: { description: "Stripe subscription id al finalizar (si aplica)" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Momento del intento" },
    }),
  },
});
