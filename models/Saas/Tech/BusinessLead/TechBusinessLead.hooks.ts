import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";

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

/** Keystone resuelve las relaciones to-many con `disconnect: []` aunque no se mande nada. */
function isNoop(value: unknown) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

/**
 * El cliente no elige tenant: se fuerza la empresa de la sesión.
 * Admin de plataforma puede mandar saasCompany en el input.
 *
 * En update se permite `connect` solo a la propia empresa (las syncs asignando leads
 * que ya existían). Ojo: en update Keystone siempre entrega `disconnect: []`; comparar
 * con `== null` strippeaba el connect de todo usuario que no fuera admin de plataforma,
 * y la sync de INEGI cobraba leads que nunca quedaban en la empresa.
 */
async function resolveTenant({ resolvedData, context, operation }: any) {
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
        isNoop(sc.disconnect) &&
        sc.set == null;
      if (onlyOwnConnect) {
        return {
          ...resolvedData,
          saasCompany: { connect: ids.map((id) => ({ id })) },
        };
      }
    }

    return stripTenantFromClient(resolvedData, "saasCompany");
}

export const businessLeadHooks = {
  resolveInput: async (args: any) => {
    const data = await resolveTenant(args);
    // `resolvedData` trae todas las llaves; las que no vienen en el cambio valen `undefined`.
    // `businessNameSearch` solo se recalcula cuando llega un businessName (alta, o edición
    // que lo cambia). Corre también con `context.sudo()`: cubre importaciones y syncs.
    if (typeof data?.businessName !== "string") return data;
    return { ...data, businessNameSearch: normalizeSearchText(data.businessName) };
  },
  afterOperation: async () => {},
};
