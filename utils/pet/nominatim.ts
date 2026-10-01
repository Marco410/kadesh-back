const CITY_KEYS = ["city", "town", "municipality", "county"] as const;
const NEIGHBORHOOD_KEYS = [
  "suburb",
  "neighbourhood",
  "city_district",
  "quarter",
  "hamlet",
  "village",
] as const;

export type ReversePlace = {
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  postalCode: string;
  address: string;
};

type NominatimAddress = Record<string, string | undefined>;

function cleanAdmin(value: string) {
  return value.trim().replace(/^municipio de\s+/i, "").trim();
}

function firstOf(address: NominatimAddress, keys: readonly string[]) {
  for (const key of keys) {
    const value = address[key];
    if (value?.trim()) return cleanAdmin(value);
  }
  return "";
}

/**
 * Ciudad desde el municipio, nunca desde la colonia ni el código postal.
 * El CP 58880 de "La Aldea, Morelia" pertenece a Tarímbaro y no define la ciudad.
 */
export function parseReversePlace(data: {
  display_name?: string;
  address?: NominatimAddress;
}): ReversePlace {
  const address = data.address ?? {};
  const street =
    [address.road, address.house_number].filter(Boolean).join(" ") ||
    data.display_name?.split(",")[0]?.trim() ||
    "";
  return {
    address: street,
    city: firstOf(address, CITY_KEYS),
    state: address.state?.trim() || "",
    country: address.country?.trim() || "",
    neighborhood: firstOf(address, NEIGHBORHOOD_KEYS),
    postalCode: address.postcode?.trim() || "",
  };
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReversePlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
      `&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "es",
        "User-Agent": "KadeshPet/1.0 (https://pet.kadesh.com.mx)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: NominatimAddress;
    };
    return parseReversePlace(data);
  } catch (error) {
    console.error("[nominatim] reverse geocode falló", error);
    return null;
  }
}
