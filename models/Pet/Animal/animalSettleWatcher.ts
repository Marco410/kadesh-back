import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * El alta pública hace tres mutaciones seguidas: Animal, luego AnimalLog
 * (el slug puede cambiar con status y ciudad) y al final las fotos.
 * Lo que se haga «cuando el reporte ya está completo» (publicar en Facebook, el correo al
 * dueño) espera aquí: si se hace antes, sale el slug viejo y la tarjeta Open Graph se cachea
 * sin foto.
 *
 * La espera vive en este proceso. Si el proceso se reinicia antes de que venza, esa acción no
 * se hace.
 */

/** Sin fotos: se actúa igual, ya con el slug del primer log. */
export const SETTLE_FALLBACK_MS = 90_000;
/** Tras la última foto de la tanda, para no actuar a medias. */
export const SETTLE_AFTER_COVER_MS = 2_500;

type SettleAction = (
  animalId: string,
  context: KeystoneContext,
) => Promise<unknown>;

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  context: KeystoneContext;
  coverSeen: boolean;
};

export type AnimalSettleWatcher = {
  /**
   * Empieza (o reinicia) la espera de un animal. Con `coverSeen` la portada ya está guardada y
   * se actúa poco después; si no, se espera a las fotos o a que pase la espera larga.
   */
  watch(animalId: string, context: KeystoneContext, opts?: { coverSeen?: boolean }): void;
};

type RegisteredWatcher = {
  pending: Map<string, Pending>;
  schedule(animalId: string, context: KeystoneContext, delayMs: number, coverSeen: boolean): void;
};

const watchers: RegisteredWatcher[] = [];

/**
 * Crea una espera independiente. `resolveAction` se consulta al vencer, así quien la crea puede
 * registrar la acción después (evita importaciones circulares).
 */
export function createAnimalSettleWatcher(
  label: string,
  resolveAction: () => SettleAction | null,
): AnimalSettleWatcher {
  const pending = new Map<string, Pending>();

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
      const action = resolveAction();
      if (!action) {
        console.error(`[${label}] Animal ${animalId} quedó en espera pero no hay acción registrada.`);
        return;
      }
      void action(animalId, current.context).catch((error: unknown) => {
        console.error(`[${label}] Falló la acción del animal ${animalId}:`, error);
      });
    }, delayMs);

    timer.unref?.();
    pending.set(animalId, {
      timer,
      context,
      coverSeen: coverSeen || previous?.coverSeen === true,
    });
  }

  watchers.push({ pending, schedule });

  return {
    watch(animalId, context, opts) {
      const coverSeen = opts?.coverSeen === true;
      schedule(animalId, context, coverSeen ? SETTLE_AFTER_COVER_MS : SETTLE_FALLBACK_MS, coverSeen);
    },
  };
}

/**
 * El primer log ya corrió: el slug público es el definitivo.
 * En cada espera abierta: si la portada ya está, actúa enseguida; si no, reinicia la espera larga.
 */
export function noteAnimalSlugSettled(
  animalId: string,
  context: KeystoneContext,
): void {
  for (const watcher of watchers) {
    const current = watcher.pending.get(animalId);
    if (!current) continue;
    watcher.schedule(
      animalId,
      context,
      current.coverSeen ? SETTLE_AFTER_COVER_MS : SETTLE_FALLBACK_MS,
      current.coverSeen,
    );
  }
}

/** Una foto ya está guardada. Cada espera abierta actúa poco después de la última de la tanda. */
export function noteAnimalCoverSaved(
  animalId: string,
  context: KeystoneContext,
): void {
  for (const watcher of watchers) {
    if (!watcher.pending.has(animalId)) continue;
    watcher.schedule(animalId, context, SETTLE_AFTER_COVER_MS, true);
  }
}
