import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * El alta pública hace tres mutaciones seguidas: Animal, luego AnimalLog
 * (el slug puede cambiar con status y ciudad) y al final las fotos.
 * Publicar en el create manda el slug viejo y Facebook cachea la tarjeta sin foto.
 *
 * La espera vive en este proceso. Si el proceso se reinicia antes de publicar,
 * ese animal no sale en la Página.
 */

/** Sin fotos: se publica igual, ya con el slug del primer log. */
const FALLBACK_MS = 90_000;
/** Tras la última foto de la tanda, para no publicar a medias. */
const AFTER_COVER_MS = 2_500;

type PublishAnimal = (
  animalId: string,
  context: KeystoneContext,
) => Promise<void>;

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  context: KeystoneContext;
  coverSeen: boolean;
};

const pending = new Map<string, Pending>();

let publishAnimal: PublishAnimal | null = null;

export function setAnimalFacebookPublisher(fn: PublishAnimal): void {
  publishAnimal = fn;
}

function schedule(
  animalId: string,
  context: KeystoneContext,
  delayMs: number,
  coverSeen: boolean,
): void {
  const previous = pending.get(animalId);
  if (previous) clearTimeout(previous.timer);

  const timer = setTimeout(() => {
    const current = pending.get(animalId);
    if (!current || current.timer !== timer) return;
    pending.delete(animalId);
    if (!publishAnimal) {
      console.error(
        `[facebook] Animal ${animalId} quedó en espera pero no hay publicador.`,
      );
      return;
    }
    void publishAnimal(animalId, current.context).catch((error: unknown) => {
      console.error("[facebook] No se pudo publicar el animal:", error);
    });
  }, delayMs);

  timer.unref?.();
  pending.set(animalId, {
    timer,
    context,
    coverSeen: coverSeen || previous?.coverSeen === true,
  });
}

/** Admin acaba de crear el animal. Todavía pueden faltar el log y la portada. */
export function watchAnimalForFacebook(
  animalId: string,
  context: KeystoneContext,
): void {
  schedule(animalId, context, FALLBACK_MS, false);
}

/**
 * El primer log ya corrió: el slug público es el definitivo.
 * Si la portada ya está, publica enseguida. Si no, reinicia la espera larga.
 */
export function noteAnimalSlugSettled(
  animalId: string,
  context: KeystoneContext,
): void {
  const current = pending.get(animalId);
  if (!current) return;
  schedule(
    animalId,
    context,
    current.coverSeen ? AFTER_COVER_MS : FALLBACK_MS,
    current.coverSeen,
  );
}

/** Una foto ya está guardada. Publica poco después de la última de la tanda. */
export function noteAnimalCoverSaved(
  animalId: string,
  context: KeystoneContext,
): void {
  if (!pending.has(animalId)) return;
  schedule(animalId, context, AFTER_COVER_MS, true);
}
