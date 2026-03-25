import { KeystoneContext } from "@keystone-6/core/types";
import { genUniqueLink } from "../../utils/helpers/unike_link";
import {
  sendAdminUserBankDetailsUpdatedEmail,
  sendUserWelcomeEmail,
} from "../../utils/helpers/sendgrid";
import { Role } from "../Role/constants";
import Stripe from "../../utils/intregrations/stripe";

const USER_BANK_NOTIFICATION_FIELDS = ["bank", "clabe", "cardNumber"] as const;

export const phoneHooks = {
  validateInput: async ({ resolvedData, addValidationError }: any) => {
    const { phone } = resolvedData;
    if (phone) {
      const pattern = /\+?\d{10,}(?:-?\d+)*$/;
      if (!pattern.test(phone) || (phone.length < 10 && phone.length !== 0)) {
        addValidationError(
          "El teléfono debe ser de 10 dígitos y puros números"
        );
      }
    }
    return phone;
  },
};

export const emailHooks = {
  validateInput: async ({ resolvedData, addValidationError }: any) => {
    const { email } = resolvedData;

    if (email && email !== "") {
      // if email comes, verifies regex
      const pattern =
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (!pattern.test(email)) {
        addValidationError("El formato del correo es incorrecto");
      }
    }
    return email;
  },
};

export const userNameHook = {
  resolveInput: async ({ resolvedData, item, context }: any) => {
    if (item && resolvedData.username) {
      return resolvedData.username;
    }
    
    if (item && !resolvedData.username) {
      return item.username;
    }

    if (!item && resolvedData.username) {
      return resolvedData.username;
    }

    if (!item && !resolvedData.username) {
      const name = resolvedData.name;
      const lastName = resolvedData.lastName || "";
      
      if (name) {
        return checkUserName(name, lastName, context);
      }
    }

    return resolvedData.username;
  },
};

export async function checkUserName(name: string, lastName: string, context: KeystoneContext): Promise<string> {
    if (!name) {
      throw new Error("El nombre es requerido para generar el username");
    }

    const namePart = name.trim();
    const lastNamePart = lastName ? lastName.trim() : "";
    const fullName = lastNamePart ? `${namePart} ${lastNamePart}` : namePart;
    let baseLink = genUniqueLink(fullName);

    if (!baseLink || baseLink === "") {
      baseLink = "user";
    }

    let uniqueLink: string = baseLink;

    let existingUser = await context.db.User.findOne({
      where: { username: uniqueLink },
    });

    let counter = 1;
    while (existingUser) {
      const randomNum1 = Math.floor(Math.random() * 100).toString();
      uniqueLink = `${baseLink}${randomNum1}`;
      existingUser = await context.db.User.findOne({
        where: { username: uniqueLink },
      });
      counter++;
    }

    return uniqueLink;
};

export const userRoleHook = {
  resolveInput: async ({ resolvedData, item, operation, context }: any) => {
    if (operation === "create" && !item) {
      const hasRoles = resolvedData.roles && (
        (resolvedData.roles.connect && resolvedData.roles.connect.length > 0) ||
        (resolvedData.roles.set && resolvedData.roles.set.length > 0) ||
        (resolvedData.roles.create && resolvedData.roles.create.length > 0)
      );

      if (!hasRoles) {
        try {
          const userRole = await context.db.Role.findOne({
            where: { name: Role.USER },
          });

          if (userRole) {
            resolvedData.roles = {
              connect: [{ id: userRole.id }],
            };
          }
        } catch (error) {
          console.error("Error al asignar el role 'user':", error);
        }
      }
    }
    return resolvedData;
  },
};

const REFERRAL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateReferralSuffix(length = 5): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * REFERRAL_CHARS.length);
    result += REFERRAL_CHARS[index];
  }
  return result;
}

async function generateUniqueReferralCode(
  context: KeystoneContext
): Promise<string> {
  while (true) {
    const candidate = "K" + generateReferralSuffix(5);
    const existing = await context.sudo().query.User.findOne({
      where: { referralCode: candidate },
      query: "id",
    });
    if (!existing) {
      return candidate;
    }
  }
}

export const userReferralHook = {
  resolveInput: async ({
    resolvedData,
    item,
    operation,
    context,
  }: {
    resolvedData: Record<string, unknown>;
    item: any;
    operation: "create" | "update";
    context: KeystoneContext;
  }) => {
    if (operation === "create" && !item && !resolvedData.referralCode) {
      const code = await generateUniqueReferralCode(context);
      resolvedData.referralCode = code;
    }

    if (resolvedData.referralCode) {
      const code = String(resolvedData.referralCode).toUpperCase();
      const pattern = /^K[A-Z0-9]{5}$/;

      if (!pattern.test(code)) {
        throw new Error(
          "El código de referido debe empezar con K y tener 5 caracteres alfanuméricos más (total 6)."
        );
      }

      resolvedData.referralCode = code;
    }

    return resolvedData;
  },
};

/** On user create, finds or creates a Stripe customer and sets stripeCustomerId. */
export const stripeCustomerHook = {
  resolveInput: async ({
    resolvedData,
    operation,
  }: {
    resolvedData: Record<string, unknown>;
    operation: string;
  }) => {
    if (operation !== "create") return resolvedData;
    const email = resolvedData.email as string | undefined;
    if (!email || typeof email !== "string") return resolvedData;
    if (!process.env.STRIPE_SECRET_KEY) return resolvedData;

    try {
      const existingCustomers = await Stripe.customers.list({
        email: email,
        limit: 1,
      });

      let stripeResp;
      if (existingCustomers.data.length > 0) {
        stripeResp = existingCustomers.data[0];
      } else {
        stripeResp = await Stripe.customers.create({
          name: `${resolvedData.name ?? ""} ${resolvedData.lastName ?? ""}`.trim(),
          email: email,
          phone: (resolvedData.phone as string) ?? undefined,
        });
      }

      resolvedData.stripeCustomerId = stripeResp.id;
    } catch (_) {
      // leave stripeCustomerId unset on error
    }
    return resolvedData;
  },
};

export const userWelcomeEmailHook = {
  afterOperation: async (args: any) => {
    const { listKey, operation, item } = args;
    if (listKey !== "User" || operation !== "create" || !item) return;
    const email = item.email;
    if (!email || String(email).trim() === "") return;

    const displayName =
      [item.name, item.lastName].filter(Boolean).join(" ").trim() || "ahí";

    try {
      await sendUserWelcomeEmail({
        to: String(email),
        displayName,
      });
    } catch (err) {
      console.error("Error enviando correo de bienvenida:", err);
    }
  },
};

export const userBankDetailsNotificationHook = {
  afterOperation: async (args: any) => {
    const { listKey, operation, inputData, item } = args;
    if (listKey !== "User" || operation !== "update" || !item?.id) return;
    if (!inputData) return;

    const fieldsUpdated = USER_BANK_NOTIFICATION_FIELDS.filter((f) =>
      Object.prototype.hasOwnProperty.call(inputData, f),
    );
    if (fieldsUpdated.length === 0) return;

    const userId = String(item.id);
    const userName =
      [item.name, item.lastName].filter(Boolean).join(" ").trim() || "(sin nombre)";
    const userEmail = item.email ?? "";

    try {
      await sendAdminUserBankDetailsUpdatedEmail({
        userId,
        userEmail,
        userName,
        fieldsUpdated: [...fieldsUpdated],
      });
    } catch (err) {
      console.error("Error enviando aviso de actualización de datos bancarios:", err);
    }
  },
};

export const userBlogSubscriptionHook = {
  afterOperation: async ({ operation, item, context }: any) => {
    if (operation === "create" && item && item.email) {
      try {
        const existingSubscription = await context.db.BlogSubscription.findOne({
          where: { email: item.email },
        });

        if (!existingSubscription) {
          await context.db.BlogSubscription.createOne({
            data: {
              email: item.email,
              user: { connect: { id: item.id } },
              active: true,
            },
          });
        } else if (existingSubscription && !existingSubscription.userId) {
          await context.db.BlogSubscription.updateOne({
            where: { id: existingSubscription.id },
            data: {
              user: { connect: { id: item.id } },
            },
          });
        }
      } catch (error) {
        console.error("Error al crear suscripción de blog para el usuario:", error);
      }
    }
  },
};
