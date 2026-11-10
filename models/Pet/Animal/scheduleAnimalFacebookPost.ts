import type { KeystoneContext } from "@keystone-6/core/types";
import { createAnimalSettleWatcher } from "./animalSettleWatcher";

/**
 * Publicación en la Página de Facebook cuando el reporte ya está completo (slug del primer log y
 * portada). La espera la lleva `animalSettleWatcher.ts`: 90 s sin fotos, 2.5 s tras la última.
 */

type PublishAnimal = (
  animalId: string,
  context: KeystoneContext,
) => Promise<unknown>;

let publishAnimal: PublishAnimal | null = null;

export function setAnimalFacebookPublisher(fn: PublishAnimal): void {
  publishAnimal = fn;
}

const facebookWatcher = createAnimalSettleWatcher("facebook", () => publishAnimal);

/** Admin acaba de crear el animal. Todavía pueden faltar el log y la portada. */
export function watchAnimalForFacebook(
  animalId: string,
  context: KeystoneContext,
): void {
  facebookWatcher.watch(animalId, context);
}

// Las fotos y el primer log avisan a todas las esperas (Facebook y correo al dueño).
export { noteAnimalCoverSaved, noteAnimalSlugSettled } from "./animalSettleWatcher";
