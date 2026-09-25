import { KeystoneContext } from "@keystone-6/core/types";
import {
  sendAdminUserBankDetailsUpdatedEmail,
  sendUserWelcomeEmail,
  emailBrandForUser,
} from "../../utils/helpers/sendgrid";
import { Role } from "../Role/constants";
import { PRODUCT } from "../../utils/constants/product";
import Stripe from "../../utils/intregrations/stripe";
import { hasRole } from "../../auth/permissions";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
} from "../../utils/access/tenant";

const USER_BANK_NOTIFICATION_FIELDS = ["bank", "clabe", "cardNumber"] as const;

export const phoneHooks = {
  validateInput: async ({ resolvedData, addValidationError }: any) => {
    const { phone } = resolvedData;
    if (phone) {
      const pattern = /\+?\d{10,}(?:-?\d+)*$/;
      if (!pattern.test(phone) || (phone.length < 10 && phone.length !== 0)) {
        addValidationError(
          "El teléfono debe ser de 10 dígitos y puros números",
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

function slugifyUsername(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug || "user";
}

async function usernameTaken(
  context: KeystoneContext,
  username: string,
): Promise<boolean> {
  const rows = await context.sudo().query.User.findMany({
    where: { username: { equals: username } },
    take: 1,
    query: "id",
  });
  return rows.length > 0;
}

export const userNameHook = {
  resolveInput: async ({ resolvedData, item, context, operation }: any) => {
    if (operation === "update" || item) {
      if (resolvedData.username) return resolvedData.username;
      return item?.username;
    }

    const name = resolvedData.name;
    const lastName = resolvedData.lastName || "";
    const preferred = resolvedData.username;
    if (preferred || name) {
      return checkUserName(name || "user", lastName, context, preferred);
    }
    return checkUserName("user", "", context);
  },
};

export async function checkUserName(
  name: string,
  lastName: string,
  context: KeystoneContext,
  preferred?: string | null,
): Promise<string> {
  const source =
    preferred?.trim() || [name, lastName].filter(Boolean).join(" ") || "user";
  const baseLink = slugifyUsername(source);

  if (!(await usernameTaken(context, baseLink))) {
    return baseLink;
  }

  for (let n = 2; n <= 99; n += 1) {
    const candidate = `${baseLink}${n}`;
    if (!(await usernameTaken(context, candidate))) {
      return candidate;
    }
  }

  return `${baseLink}${Date.now().toString(36)}`;
}

function relationIds(value: unknown): string[] {
  if (!value) return [];
  const rows = Array.isArray(value) ? value : [value];
  return rows
    .map((row) =>
      row && typeof row === "object" && "id" in row
        ? String((row as { id: string }).id)
        : "",
    )
    .filter(Boolean);
}

export const userRoleHook = {
  resolveInput: async ({ resolvedData, item, operation, context }: any) => {
    if (operation === "create" && !item && !isPlatformAdmin(context.session)) {
      const sessionCompanyId = getSessionCompanyId(context.session);
      if (sessionCompanyId && hasRole(context.session, [Role.ADMIN_COMPANY])) {
        resolvedData.company = { connect: { id: sessionCompanyId } };
      } else if (isSignedIn(context.session)) {
        delete resolvedData.company;
      }
    }

    if (isPlatformAdmin(context.session)) {
      return resolvedData;
    }

    const roleInput = resolvedData.roles as
      | {
          connect?: { id: string }[] | { id: string };
          set?: { id: string }[] | { id: string };
          create?: unknown[];
        }
      | undefined;

    if (roleInput?.create) {
      delete roleInput.create;
    }

    const connectIds = [
      ...relationIds(roleInput?.connect),
      ...relationIds(roleInput?.set),
    ];

    if (connectIds.length > 0) {
      const roles = (await context.sudo().query.Role.findMany({
        where: { id: { in: connectIds } },
        query: "id name",
      })) as { id: string; name: string }[];
      const allowed = roles.filter((role) => role.name !== Role.ADMIN);
      if (allowed.length !== roles.length) {
        resolvedData.roles = {
          connect: allowed.map((role) => ({ id: role.id })),
        };
      }
    }

    if (operation === "create" && !item) {
      const hasRoles =
        relationIds(resolvedData.roles?.connect).length > 0 ||
        relationIds(resolvedData.roles?.set).length > 0;
      if (!hasRoles) {
        try {
          const [userRole] = await context.sudo().query.Role.findMany({
            where: { name: { equals: Role.USER } },
            take: 1,
            query: "id",
          });
          if (userRole) {
            resolvedData.roles = { connect: [{ id: userRole.id }] };
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
  context: KeystoneContext,
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
          "El código de referido debe empezar con K y tener 5 caracteres alfanuméricos más (total 6).",
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
    delete resolvedData.stripeCustomerId;
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

/**
 * Marca de los correos de un usuario. `product` es la fuente de verdad (lo manda cada front
 * al registrarse); `companyId` cubre usuarios anteriores al campo, que quedaron como "pet".
 */
function userEmailBrand(item: { product?: string | null; companyId?: unknown }) {
  return emailBrandForUser(
    item.product === PRODUCT.SAAS || Boolean(item.companyId),
  );
}

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
        brand: userEmailBrand(item),
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
      [item.name, item.lastName].filter(Boolean).join(" ").trim() ||
      "(sin nombre)";
    const userEmail = item.email ?? "";

    try {
      await sendAdminUserBankDetailsUpdatedEmail({
        userId,
        userEmail,
        userName,
        fieldsUpdated: [...fieldsUpdated],
        brand: userEmailBrand(item),
      });
    } catch (err) {
      console.error(
        "Error enviando aviso de actualización de datos bancarios:",
        err,
      );
    }
  },
};

export const userBlogSubscriptionHook = {
  afterOperation: async ({ operation, item, context }: any) => {
    if (operation === "create" && item && item.email) {
      try {
        const sudo = context.sudo();
        // La unicidad es (email, product): no existe where único por email.
        const product = item.product === PRODUCT.SAAS ? PRODUCT.SAAS : PRODUCT.PET;
        const [existingSubscription] = await sudo.db.BlogSubscription.findMany({
          where: { email: { equals: item.email }, product: { equals: product } },
          take: 1,
        });

        if (!existingSubscription) {
          await sudo.db.BlogSubscription.createOne({
            data: {
              email: item.email,
              product,
              user: { connect: { id: item.id } },
              active: true,
            },
          });
        } else if (!existingSubscription.userId) {
          await sudo.db.BlogSubscription.updateOne({
            where: { id: existingSubscription.id },
            data: {
              user: { connect: { id: item.id } },
            },
          });
        }
      } catch (error) {
        console.error(
          "Error al crear suscripción de blog para el usuario:",
          error,
        );
      }
    }
  },
};
