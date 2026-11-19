import { normalizeStateCode, stateByCode } from "../geo/mexicoStates";
import { normalizeMxPhone } from "../pet/phone";

/** A shipping address as the checkout sends it. */
export type StoreAddressInput = {
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  street?: string | null;
  exteriorNumber?: string | null;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  /** INEGI code ("16"), name or slug of the state. */
  state?: string | null;
  postalCode?: string | null;
  references?: string | null;
};

export type StoreAddressData = {
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  stateCode: string;
  postalCode: string;
  references: string;
};

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Cleans and checks an address. Carriers need all of this, so nothing here is optional but the interior number, the label and the references. */
export function validateStoreAddress(
  input: StoreAddressInput | null | undefined,
): { ok: true; data: StoreAddressData } | { ok: false; message: string } {
  const recipientName = clean(input?.recipientName, 120);
  if (recipientName.length < 3) return { ok: false, message: "Escribe el nombre de quien recibe." };
  const phone = normalizeMxPhone(input?.phone ?? "");
  if (!phone.ok) return { ok: false, message: "El teléfono de quien recibe debe tener 10 dígitos." };
  const street = clean(input?.street, 160);
  if (!street) return { ok: false, message: "Escribe la calle." };
  const exteriorNumber = clean(input?.exteriorNumber, 20);
  if (!exteriorNumber) return { ok: false, message: "Escribe el número exterior (o «S/N»)." };
  const neighborhood = clean(input?.neighborhood, 120);
  if (!neighborhood) return { ok: false, message: "Escribe la colonia." };
  const city = clean(input?.city, 120);
  if (!city) return { ok: false, message: "Escribe el municipio o alcaldía." };
  const stateCode = normalizeStateCode(input?.state);
  if (!stateCode) return { ok: false, message: "Elige el estado." };
  const postalCode = (input?.postalCode ?? "").replace(/\D/g, "");
  if (postalCode.length !== 5) return { ok: false, message: "El código postal debe tener 5 dígitos." };

  return {
    ok: true,
    data: {
      label: clean(input?.label, 40),
      recipientName,
      phone: phone.digits,
      street,
      exteriorNumber,
      interiorNumber: clean(input?.interiorNumber, 20),
      neighborhood,
      city,
      stateCode,
      postalCode,
      references: clean(input?.references, 300),
    },
  };
}

export function storeStateName(code: string | null | undefined): string {
  return stateByCode(code)?.name ?? "";
}

/** A saved address (no prefix) or the one copied on an order (`ship` prefix) as the API returns it. */
export function toStoreAddress(row: Record<string, any>, prefix = "") {
  const read = (field: string) => {
    const key = prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;
    return (row[key] as string | null | undefined) ?? "";
  };
  const stateCode = read("stateCode");
  return {
    id: prefix ? null : (row.id as string),
    label: prefix ? null : read("label") || null,
    recipientName: read("recipientName"),
    phone: read("phone"),
    street: read("street"),
    exteriorNumber: read("exteriorNumber"),
    interiorNumber: read("interiorNumber") || null,
    neighborhood: read("neighborhood"),
    city: read("city"),
    stateCode,
    stateName: storeStateName(stateCode),
    postalCode: read("postalCode"),
    references: read("references") || null,
    isDefault: prefix ? false : Boolean(row.isDefault),
  };
}

export const STORE_ADDRESS_TYPEDEFS = `
  input StoreShippingAddressInput {
    label: String
    recipientName: String!
    "10 digits"
    phone: String!
    street: String!
    exteriorNumber: String!
    interiorNumber: String
    "Colonia"
    neighborhood: String!
    "Municipio o alcaldía"
    city: String!
    "INEGI code (16), name or slug of the state"
    state: String!
    "5 digits"
    postalCode: String!
    references: String
  }

  type StoreShippingAddress {
    id: ID
    label: String
    recipientName: String!
    phone: String!
    street: String!
    exteriorNumber: String!
    interiorNumber: String
    neighborhood: String!
    city: String!
    "INEGI code of the state"
    stateCode: String!
    stateName: String!
    postalCode: String!
    references: String
    isDefault: Boolean!
  }
`;
