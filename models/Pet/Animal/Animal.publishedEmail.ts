import type { KeystoneContext } from "@keystone-6/core/types";
import { ANIMAL_LOGS_OPTIONS, ANIMAL_SEX_OPTIONS } from "../../../utils/constants/constants";
import {
  sendAnimalPublishedEmail,
  type AnimalPublishedEmailInput,
} from "../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../utils/intregrations/smtpMail";
import { automationUserId } from "../../../utils/notifications/animalReportAlerts";
import { petSiteUrl } from "../../../utils/notifications/whatsapp";
import { petPublicUrl } from "../../../utils/pet/animalReport";
import { isGenericName } from "../../../utils/pet/reportSimilarity";
import {
  capitalize,
  dateOf,
  gender,
  NO_BREED,
  placeOf,
  statusPlaceDateLabels,
  typeInfo,
} from "./Animal.facebookPost";
import { createAnimalSettleWatcher } from "./animalSettleWatcher";

/**
 * Correo al dueño de un reporte cuando ya quedó completo: datos del animal y lo que puede hacer
 * después (compartir, agregar registros, editar, alertas de zona, avisos por WhatsApp e impulsar
 * en Facebook). Arranca con el primer registro (`animalLogSlugAfterOperation`) y sale cuando ya
 * están las fotos, para que la tarjeta `/animales/{slug}/og` no se cachee sin foto.
 */

/** Enlaces directos que la ficha de la web entiende (kadesh-landing `ANIMAL_DETAIL_ACTION`). */
export const ANIMAL_DETAIL_ACTION = { addLog: "registro", promote: "impulsar" } as const;

const PROMOTABLE_STATUSES = new Set(["lost", "found"]);

const PUBLISHED_EMAIL_QUERY = `
  id name slug sex age color size
  duplicateOf { id }
  animal_type { name }
  animal_breed { breed }
  organization { name }
  logs(orderBy: [{ createdAt: asc }], take: 1) {
    status date_status placeLabel neighborhood city state
  }
  user {
    id name email anonymizedAt suspendedAt
    whatsappNotifications petAlertsEnabled alertCity alertRadiusKm
  }
`;

type PublishedEmailAnimal = {
  id: string;
  name?: string | null;
  slug?: string | null;
  sex?: string | null;
  age?: string | null;
  color?: string | null;
  size?: string | null;
  duplicateOf?: { id: string } | null;
  animal_type?: { name?: string | null } | null;
  animal_breed?: { breed?: string | null } | null;
  organization?: { name?: string | null } | null;
  logs?: Array<{
    status?: string | null;
    date_status?: string | null;
    placeLabel?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  }> | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    anonymizedAt?: string | null;
    suspendedAt?: string | null;
    whatsappNotifications?: boolean | null;
    petAlertsEnabled?: boolean | null;
    alertCity?: string | null;
    alertRadiusKm?: number | null;
  } | null;
};

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function optionLabel(options: ReadonlyArray<{ label: string; value: string }>, value?: string | null) {
  return options.find((option) => option.value === value)?.label ?? "";
}

/** Arma los datos del correo. null si no se debe mandar. */
export function buildAnimalPublishedEmailInput(
  animal: PublishedEmailAnimal,
): AnimalPublishedEmailInput | null {
  const owner = animal.user;
  const to = clean(owner?.email);
  if (!owner || !to || owner.anonymizedAt || owner.suspendedAt) return null;
  const automation = automationUserId();
  if (automation && owner.id === automation) return null;
  if (animal.duplicateOf || !animal.slug) return null;

  const log = animal.logs?.[0] ?? null;
  const status = clean(log?.status).toLowerCase();
  const sex = animal.sex;
  const type = typeInfo(animal.animal_type?.name);
  const rawName = clean(animal.name);
  const animalName = rawName && !isGenericName(rawName) ? rawName : "";
  const unnamedWho = type.little[gender(sex)];
  const statusLabel = optionLabel(ANIMAL_LOGS_OPTIONS, status) || "Publicado";

  const breed = clean(animal.animal_breed?.breed);
  const typeAndBreed = [type.label, breed && !NO_BREED.test(breed) ? breed : ""].filter(Boolean).join(" · ");
  const sexLabel = sex === "male" || sex === "female" ? optionLabel(ANIMAL_SEX_OPTIONS, sex) : "";
  const place = placeOf(log);
  const labels = statusPlaceDateLabels(status, sex);
  const when = dateOf(log?.date_status);

  const facts: Array<readonly [string, string]> = (
    [
      ["Tipo", typeAndBreed],
      ["Sexo", sexLabel],
      ["Edad", clean(animal.age)],
      ["Color", clean(animal.color)],
      ["Tamaño", clean(animal.size)],
      [labels.place, place],
      [labels.date, when],
      ["Espacio de rescate", clean(animal.organization?.name)],
    ] as const
  ).filter(([, value]) => Boolean(value));

  const city = clean(log?.city);
  const shareTitle = `${animalName || capitalize(unnamedWho)} · ${statusLabel}${
    city && !/^sin especificar$/i.test(city) ? ` en ${city}` : ""
  }`;

  const slug = animal.slug;
  const detail = `/animales/${slug}`;

  return {
    to,
    displayName: clean(owner.name),
    animalName,
    unnamedWho,
    gender: gender(sex),
    status,
    statusLabel,
    facts,
    shareTitle,
    links: {
      report: petPublicUrl(slug),
      image: petSiteUrl(`${detail}/og`),
      addLog: petSiteUrl(`${detail}?accion=${ANIMAL_DETAIL_ACTION.addLog}`),
      edit: petSiteUrl(`${detail}/editar`),
      alerts: petSiteUrl("/notificaciones/alertas"),
      notificationSettings: petSiteUrl("/notificaciones/ajustes"),
      myReports: petSiteUrl("/perfil?tab=animals"),
      promote: PROMOTABLE_STATUSES.has(status)
        ? petSiteUrl(`${detail}?accion=${ANIMAL_DETAIL_ACTION.promote}`)
        : null,
    },
    zoneAlert: owner.petAlertsEnabled
      ? { city: clean(owner.alertCity), radiusKm: owner.alertRadiusKm ?? null }
      : null,
    whatsappOn: owner.whatsappNotifications === true,
  };
}

/** Relee el reporte ya completo y manda el correo a su dueño. Nunca lanza. */
export async function sendAnimalPublishedEmailFor(
  animalId: string,
  context: KeystoneContext,
): Promise<void> {
  if (!isSmtpConfigured()) return;
  try {
    const animal = (await context.sudo().query.Animal.findOne({
      where: { id: animalId },
      query: PUBLISHED_EMAIL_QUERY,
    })) as PublishedEmailAnimal | null;
    // Ya no existe: lo borró `removeIncompleteOwnReports` o su dueño.
    if (!animal) return;
    const input = buildAnimalPublishedEmailInput(animal);
    if (!input) return;
    await sendAnimalPublishedEmail(input);
  } catch (error) {
    console.error(`[animal] No se pudo mandar el correo de reporte publicado (${animalId}):`, error);
  }
}

const publishedEmailWatcher = createAnimalSettleWatcher(
  "animal-published-email",
  () => sendAnimalPublishedEmailFor,
);

/**
 * Primer registro del reporte: espera a las fotos (2.5 s tras la última, 90 s si no llega
 * ninguna) y manda el correo. Con `coverSeen` las fotos ya estaban (alta anidada en el Admin).
 */
export function watchAnimalForPublishedEmail(
  animalId: string,
  context: KeystoneContext,
  opts?: { coverSeen?: boolean },
): void {
  publishedEmailWatcher.watch(animalId, context, opts);
}
