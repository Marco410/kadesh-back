import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { getSessionCompanyId } from "../../../../utils/access/tenant";

function stripTenantFromClient(
  resolvedData: Record<string, unknown>,
  key: string,
) {
  const next = { ...resolvedData };
  delete next[key];
  return next;
}

/** Normaliza `connect` de Keystone (`{ id }`, `[{ id }]`, etc.) a ids. */
function connectIds(connect: unknown): string[] {
  if (!connect) return [];
  const list = Array.isArray(connect) ? connect : [connect];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: string }).id);
      }
      return null;
    })
    .filter((id): id is string => !!id);
}

/**
 * El cliente no elige tenant: se fuerza la empresa de la sesión.
 * Admin de plataforma puede mandar saasCompany en el input.
 *
 * En update se permite `connect` solo a la propia empresa (p. ej. syncLeadsFront
 * asignando leads ya existentes). Antes se strippeaba todo saasCompany en update
 * y el sync cobraba créditos sin ligar el lead a la company.
 */
export const businessLeadHooks = {
  resolveInput: async ({
    resolvedData,
    context,
    operation,
  }: any) => {
    if (hasRole(context.session, [Role.ADMIN])) {
      return resolvedData;
    }

    const companyId = getSessionCompanyId(context.session);
    if (operation === "create" && companyId) {
      return {
        ...resolvedData,
        saasCompany: { connect: [{ id: companyId }] },
      };
    }

    if (operation === "update" && companyId && resolvedData?.saasCompany) {
      const sc = resolvedData.saasCompany as Record<string, unknown>;
      const ids = connectIds(sc.connect);
      const onlyOwnConnect =
        ids.length > 0 &&
        ids.every((id) => id === companyId) &&
        sc.disconnect == null &&
        sc.set == null;
      if (onlyOwnConnect) {
        return {
          ...resolvedData,
          saasCompany: { connect: ids.map((id) => ({ id })) },
        };
      }
    }

    return stripTenantFromClient(resolvedData, "saasCompany");
  },
  afterOperation: async () => {},
};
