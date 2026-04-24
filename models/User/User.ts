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
  userWelcomeEmailHook,
  userBankDetailsNotificationHook,
  stripeCustomerHook,
  userReferralHook,
} from "./User.hooks";
import access from "../../utils/generalAccess/access";

async function resolveInput(
  args: Parameters<typeof userRoleHook.resolveInput>[0]
) {
  const afterRole = await userRoleHook.resolveInput(args);
  const afterStripe = await stripeCustomerHook.resolveInput({
    ...args,
    resolvedData: afterRole,
  });

  const afterReferral = await userReferralHook.resolveInput({
    ...args,
    resolvedData: afterStripe,
  });

  return afterReferral;
}

export default list({
  access,
  hooks: {
    resolveInput,
    afterOperation: async (args: any) => {
      await userBlogSubscriptionHook.afterOperation(args);
      await userWelcomeEmailHook.afterOperation(args);
      await userBankDetailsNotificationHook.afterOperation(args);
    },
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "lastName",
        "secondLastName",
        "email",
        "phone",
        "roles",
        "company",
        "leadSyncLogs",
        "createdAt",
        "lastLoginAt",
      ],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    lastName: text(),
    secondLastName: text({
      db: { isNullable: true },
    }),
    username: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      hooks: userNameHook,
    }),
    referralCode: text({
      isIndexed: "unique",
      validation: { isRequired: true, length: { min: 6, max: 6 } },
      ui: {
        description: "Código de referido (K + 5 caracteres alfanuméricos)",
      },
    }),
    email: text({
      isIndexed: "unique",
      hooks: emailHooks,
    }),
    businessEmail: text({
      db: { isNullable: true },
      ui: {
        description: "Correo electrónico de la empresa",
      },
    }),
    businessPhone: text({
      db: { isNullable: true },
      ui: {
        description: "Teléfono de la empresa",
      },
    }),
    password: password({
      validation: { isRequired: false },
      ui: {
        createView: {
          fieldMode: "hidden",
        },
      },
    }),
    phone: text(),
    roles: relationship({
      ref: "Role.users",
      many: true,
    }),
    referredBy: relationship({
      ref: "User.referrals",
      ui: {
        description: "Usuario que refirió a este usuario",
      },
    }),
    referrals: relationship({
      ref: "User.referredBy",
      many: true,
      ui: {
        description: "Usuarios que este usuario ha referido",
      },
    }),
    /** Company (SaaS tenant) this user belongs to; 1 company : N users */
    company: relationship({
      ref: "SaasCompany.users",
      many: false,
      ui: { description: "Company/organization this user belongs to" },
    }),
    workspaces: relationship({
      ref: "SaasWorkspace.members",
      many: true,
      ui: { description: "Workspaces (áreas) a los que pertenece" },
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
    tasksResponsible: relationship({
      ref: "TechTask.responsible",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace asignadas" },
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
    saasSubscriptionLogs: relationship({
      ref: "SaasSubscriptionLog.user",
      many: true,
      ui: { description: "Logs de intentos de suscripción SaaS" },
    }),
    authLogs: relationship({
      ref: "UserAuthLog.user",
      many: true,
      ui: { description: "Registro de login / registro (customAuth, registerUser)" },
    }),
    quotationsCreated: relationship({
      ref: "SaasQuotation.createdBy",
      many: true,
      ui: {
        hideCreate: true,
        description: "Cotizaciones creadas por este usuario",
      },
    }),
    quotationsAssignedSeller: relationship({
      ref: "SaasQuotation.assignedSeller",
      many: true,
      ui: {
        hideCreate: true,
        description: "Cotizaciones donde actúa como vendedor asignado",
      },
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
    bank: text({
      ui: { description: "Nombre del banco" },
    }),
    clabe: text({
      db: { isNullable: true },
      ui: {
        listView: { fieldMode: "hidden" },
      },
    }),
    cardNumber: text({
      db: { isNullable: true },
      ui: {
        listView: { fieldMode: "hidden" },
      },
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
    lastLoginAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
