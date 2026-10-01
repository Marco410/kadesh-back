import { list } from "@keystone-6/core";
import {
  calendarDay,
  checkbox,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import access from "../../../../utils/generalAccess/access";
import { ANIMAL_LOGS_OPTIONS } from "../../../../utils/constants/constants";
import { animalLogSlugAfterOperation } from "../Animal.hooks";
import { fillCityFromCoordinates } from "../../../../utils/pet/animalReport";

export default list({
  access,
  hooks: {
    resolveInput: async ({ resolvedData, operation }) => {
      const data = { ...resolvedData };
      const shouldFill =
        operation === "create" ||
        "city" in data ||
        "lat" in data ||
        "lng" in data;
      if (!shouldFill) return data;
      const city = typeof data.city === "string" ? data.city : "";
      const lat = typeof data.lat === "string" ? data.lat : "";
      const lng = typeof data.lng === "string" ? data.lng : "";
      if (city.trim() || !lat.trim() || !lng.trim()) return data;
      const place = await fillCityFromCoordinates({
        city,
        state: typeof data.state === "string" ? data.state : "",
        country: typeof data.country === "string" ? data.country : "",
        neighborhood: typeof data.neighborhood === "string" ? data.neighborhood : "",
        postalCode: typeof data.postalCode === "string" ? data.postalCode : "",
        lat,
        lng,
      });
      data.city = place.city;
      if (!String(data.state || "").trim()) data.state = place.state;
      if (!String(data.country || "").trim()) data.country = place.country;
      if (!String(data.neighborhood || "").trim()) data.neighborhood = place.neighborhood;
      if (!String(data.postalCode || "").trim()) data.postalCode = place.postalCode;
      return data;
    },
    ...animalLogSlugAfterOperation,
  },
  fields: {
    animal: relationship({
      ref: "Animal.logs",
    }),
    status: select({
      defaultValue: "Registrado",
      options: ANIMAL_LOGS_OPTIONS,
    }),
    // Could be a different date when lost
    date_status: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
    notes: text({
      ui: { displayMode: "textarea" },
    }),
    lat: text(),
    lng: text(),
    address: text(),
    city: text(),
    state: text(),
    country: text(),
    neighborhood: text({
      ui: {
        description: "Colonia que resolvió el mapa. No se usa en el título ni en el slug.",
      },
    }),
    postalCode: text({
      ui: {
        description: "Código postal del mapa. No define el municipio.",
      },
    }),
    placeLabel: text({
      ui: {
        description: "Lugar que escribió quien reporta. Es el que sale en el título y el slug.",
      },
    }),
    last_seen: checkbox(),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
