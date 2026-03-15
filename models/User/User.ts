import { graphql, list } from "@keystone-6/core";
import {
  text,
  password,
  timestamp,
  virtual,
  calendarDay,
  image,
  checkbox,
  relationship,
  integer,
} from "@keystone-6/core/fields";
import {
  emailHooks,
  phoneHooks,
  userNameHook,
  userRoleHook,
  userBlogSubscriptionHook,
  stripeCustomerHook,
} from "./User.hooks";
import access from "../../utils/generalAccess/access";

async function resolveInput(
  args: Parameters<typeof userRoleHook.resolveInput>[0]
) {
  const afterRole = await userRoleHook.resolveInput(args);
  return stripeCustomerHook.resolveInput({ ...args, resolvedData: afterRole });
}

export default list({
  access,
  hooks: {
    resolveInput,
    afterOperation: userBlogSubscriptionHook.afterOperation,
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    lastName: text(),
    secondLastName: text(),
    username: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      hooks: userNameHook,
    }),
    email: text({
      isIndexed: "unique",
      hooks: emailHooks,
    }),
    password: password({
      validation: { isRequired: false },
      ui: {
        createView: {
          fieldMode: "hidden",
        },
      },
    }),
    phone: text({
      hooks: phoneHooks,
    }),
    roles: relationship({
      ref: "Role.users",
      many: true,
    }),
    /** Company (SaaS tenant) this user belongs to; 1 company : N users */
    company: relationship({
      ref: "SaasCompany.users",
      many: false,
      ui: { description: "Company/organization this user belongs to" },
    }),
    blog_subscriptions: relationship({
      ref: "BlogSubscription.user",
      many: true,
    }),
    businessLeadsAssigned: relationship({
      ref: "TechBusinessLead.salesPerson",
      many: true,
    }),
    salesActivities: relationship({
      ref: "TechSalesActivity.assignedSeller",
      many: true,
      ui: { hideCreate: true },
    }),
    followUpTasks: relationship({
      ref: "TechFollowUpTask.assignedSeller",
      many: true,
      ui: { hideCreate: true },
    }),
    proposals: relationship({
      ref: "TechProposal.assignedSeller",
      many: true,
      ui: { hideCreate: true },
    }),
    projectsResponsible: relationship({
      ref: "SaasProject.responsible",
      many: true,
      ui: { description: "Proyectos donde es responsable" },
    }),
    leadSyncLogs: relationship({
      ref: "TechLeadSyncLog.user",
      many: true,
      ui: { description: "Logs de sincronización de leads (mapa)" },
    }),
    profileImage: image({ storage: "s3_profile" }),
    birthday: calendarDay(),
    age: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any) {
          if (item?.birthday) {
            const today = new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        },
      }),
    }),
    smsRegistrationId: text(),
    verified: checkbox(),
    salesPersonVerified: checkbox(),
    salesComission: integer({
      ui: { description: "Comisión de ventas (en porcentaje)" },
      defaultValue: 10,
    }),
    stripeCustomerId: text({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
        itemView: { fieldMode: "read" },
        description: "Stripe Customer ID, created automatically on user signup",
      },
    }),
    /** SaaS payment methods (Stripe cards) saved by this user */
    saasPaymentMethods: relationship({
      ref: "SaasPaymentMethod.user",
      many: true,
      ui: { description: "Saved payment methods (Stripe)" },
    }),
    /** SaaS payments (subscriptions, one-time) made by this user */
    saasPayments: relationship({
      ref: "SaasPayment.user",
      many: true,
      ui: { description: "Payments made by this user (SaaS)" },
    }),
    techStatusBusinessLeads: relationship({
      ref: "TechStatusBusinessLead.salesPerson",
      many: true,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
