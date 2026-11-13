import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Cómo terminó un caso (`Animal.outcome`) y lo que contó quien lo cerró. Alimenta el contador de
 * reencuentros y adopciones de la portada (`petLandingStats`).
 *
 * Dos caminos llenan estos campos:
 * - `closeAnimalReport`: el cierre con preguntas («¿volvió a casa?», «¿Kadesh ayudó?»).
 * - `syncAnimalOutcomeFromLog` (hook de `AnimalLog`): cualquier otra bitácora final (web vieja,
 *   app, cartilla, adopciones, espacios de rescate). Llena `outcome` y `closedAt` sin respuestas.
 */

export const ANIMAL_OUTCOME = {
  REUNITED: "reunited",
  ADOPTED: "adopted",
  OTHER_HOME: "other_home",
  DECEASED: "deceased",
  CLOSED_UNRESOLVED: "closed_unresolved",
} as const;

export const ANIMAL_OUTCOME_OPTIONS = [
  { label: "Volvió con su familia", value: ANIMAL_OUTCOME.REUNITED },
  { label: "Adoptado", value: ANIMAL_OUTCOME.ADOPTED },
  { label: "Encontró otro hogar", value: ANIMAL_OUTCOME.OTHER_HOME },
  { label: "Falleció", value: ANIMAL_OUTCOME.DECEASED },
  { label: "Se cerró sin encontrarlo", value: ANIMAL_OUTCOME.CLOSED_UNRESOLVED },
];

export const HELPED_BY_KADESH_OPTIONS = [
  { label: "Sí", value: "yes" },
  { label: "No", value: "no" },
  { label: "No sé", value: "unsure" },
];

/** Por dónde ayudó Kadesh (solo si `helpedByKadesh` es `yes`). */
export const OUTCOME_CHANNEL_OPTIONS = [
  { label: "Mapa o ficha en la web/app", value: "map" },
  { label: "Alerta de zona", value: "zone_alert" },
  { label: "Aviso por WhatsApp", value: "whatsapp" },
  { label: "Cartel o QR", value: "poster" },
  { label: "Página de Facebook de Kadesh", value: "facebook" },
  { label: "Aviso de coincidencia", value: "match" },
  { label: "Alguien reportó que lo vio", value: "sighting" },
  { label: "Otro", value: "other" },
];

/** Bitácora que deja cada cierre. `closed` = sin hogar (falleció o se dejó de buscar). */
export const OUTCOME_LOG_STATUS: Record<string, string> = {
  [ANIMAL_OUTCOME.REUNITED]: "in_family",
  [ANIMAL_OUTCOME.ADOPTED]: "adopted",
  [ANIMAL_OUTCOME.OTHER_HOME]: "in_family",
  [ANIMAL_OUTCOME.DECEASED]: "closed",
  [ANIMAL_OUTCOME.CLOSED_UNRESOLVED]: "closed",
};

/** Desenlace que se infiere de una bitácora final que no pasó por `closeAnimalReport`. */
const LOG_STATUS_OUTCOME: Record<string, string> = {
  in_family: ANIMAL_OUTCOME.REUNITED,
  adopted: ANIMAL_OUTCOME.ADOPTED,
  closed: ANIMAL_OUTCOME.CLOSED_UNRESOLVED,
};

/** Estatus de un caso abierto. Una bitácora final solo cierra un caso si antes hubo uno de estos. */
export const OPEN_CASE_STATUSES = ["lost", "found", "rescued", "abandoned", "in_adoption"];

/** Desenlaces con hogar: los que cuenta la portada. */
export const HOME_OUTCOMES: string[] = [
  ANIMAL_OUTCOME.REUNITED,
  ANIMAL_OUTCOME.ADOPTED,
  ANIMAL_OUTCOME.OTHER_HOME,
];

const values = (options: { value: string }[]) => options.map((option) => option.value);
export const isAnimalOutcome = (value: unknown): value is string =>
  typeof value === "string" && values(ANIMAL_OUTCOME_OPTIONS).includes(value);
export const isHelpedByKadesh = (value: unknown): value is string =>
  typeof value === "string" && values(HELPED_BY_KADESH_OPTIONS).includes(value);
export const isOutcomeChannel = (value: unknown): value is string =>
  typeof value === "string" && values(OUTCOME_CHANNEL_OPTIONS).includes(value);

/** Campos de cierre en blanco: así queda un caso que se reabre. */
export const CLEARED_OUTCOME = {
  outcome: null,
  helpedByKadesh: null,
  outcomeChannel: null,
  outcomeStory: "",
  storyConsent: false,
  closedAt: null,
};

/**
 * Hook de `AnimalLog` (solo `create`). Mantiene `Animal.outcome` al día con la bitácora:
 * - Bitácora final (`in_family`, `adopted`, `closed`) en un caso que estuvo abierto y aún no tiene
 *   desenlace → lo llena (sin respuestas de «¿Kadesh ayudó?»). Si lo cerró `closeAnimalReport`,
 *   el desenlace ya está y no se toca.
 * - Bitácora de caso abierto (`lost`, `found`…) en un caso cerrado → se reabre: limpia el cierre.
 * Un animal que nace «En familia» (sin caso previo) no cuenta como reencuentro. Nunca lanza.
 */
export async function syncAnimalOutcomeFromLog({
  operation,
  item,
  context,
}: {
  operation: string;
  item: any;
  context: KeystoneContext;
}) {
  if (operation !== "create") return;
  const animalId = item?.animalId ?? item?.animal;
  const status = typeof item?.status === "string" ? item.status : "";
  if (!animalId || typeof animalId !== "string" || !status) return;

  const inferred = LOG_STATUS_OUTCOME[status];
  const reopens = OPEN_CASE_STATUSES.includes(status);
  if (!inferred && !reopens) return;

  try {
    const sudo = context.sudo();
    const animal = (await sudo.query.Animal.findOne({
      where: { id: animalId },
      query: "id outcome",
    })) as { id: string; outcome: string | null } | null;
    if (!animal) return;

    if (reopens) {
      if (!animal.outcome) return;
      await sudo.query.Animal.updateOne({ where: { id: animalId }, data: CLEARED_OUTCOME });
      return;
    }

    if (animal.outcome) return;
    const openLogs = await sudo.query.AnimalLog.count({
      where: {
        animal: { id: { equals: animalId } },
        status: { in: OPEN_CASE_STATUSES },
        id: { not: { equals: item.id } },
      },
    });
    if (!openLogs) return;
    const closedAt = item.date_status ? new Date(item.date_status).toISOString() : new Date().toISOString();
    await sudo.query.Animal.updateOne({
      where: { id: animalId },
      data: { outcome: inferred, closedAt },
    });
  } catch (error) {
    console.error("[animal] No se pudo actualizar el desenlace desde la bitácora", { animalId }, error);
  }
}
