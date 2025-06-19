import { KeystoneContext } from "@keystone-6/core/types";
import { genUniqueLink } from "../../utils/helpers/unike_link";

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
    if (item) {
      return item.username;
    }

    return checkUserName(resolvedData.name, resolvedData?.lastName, context);
  },
};

export async function checkUserName(name: string, lastName: string, context: KeystoneContext): Promise<string> {

    let baseLink = genUniqueLink(`${name.toLowerCase()}.${lastName.toLowerCase()}`);

    let uniqueLink : string = baseLink;

    let existingUser = await context.db.User.findOne({
      where: { username: uniqueLink },
    });

    let counter = 1;
    while (existingUser) {
      uniqueLink = `${baseLink}-${counter}`;
      existingUser = await context.db.User.findOne({
        where: { username: uniqueLink },
      });
      counter++;
    }

  return uniqueLink;
};
