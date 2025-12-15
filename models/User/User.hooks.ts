import { KeystoneContext } from "@keystone-6/core/types";
import { genUniqueLink } from "../../utils/helpers/unike_link";
import { Role } from "../Role/constants";

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
