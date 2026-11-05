import type { KeystoneContext } from "@keystone-6/core/types";
import { stateByCode } from "../geo/mexicoStates";
import { petSiteUrl } from "../notifications/whatsapp";

/**
 * IndexNow (https://www.indexnow.org): avisa a Bing (y Yandex, Seznam, Naver) que una página de
 * pet.kadesh.com.mx cambió, para que la rastreen en horas y no en semanas. ChatGPT y otras IA se
 * apoyan en el índice de Bing. Google no usa IndexNow (para Google: sitemap y Search Console).
 *
 * La clave es pública: la sirve la web en `/indexnow-key.txt` (kadesh-landing,
 * `src/core/indexnow.ts`). `INDEXNOW_KEY` debe ser la misma.
 * Solo en producción (`NODE_ENV=production`); `INDEXNOW=off` lo apaga. Nunca lanza.
 */

const DEFAULT_KEY = "6973631b0c498ed8f41a79e2d4c9211f";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export function indexNowEnabled(): boolean {
  if ((process.env.INDEXNOW ?? "").trim().toLowerCase() === "off") return false;
  if ((process.env.ENVIROMENT ?? "").toUpperCase() === "DEV") return false;
  return process.env.NODE_ENV === "production";
}

/** Manda las rutas (`/eventos/...`) del sitio de Pet. */
export async function submitToIndexNow(paths: string[]): Promise<void> {
  if (!indexNowEnabled() || paths.length === 0) return;
  try {
    const origin = new URL(petSiteUrl("/")).origin;
    const host = new URL(origin).hostname;
    const key = process.env.INDEXNOW_KEY?.trim() || DEFAULT_KEY;
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${origin}/indexnow-key.txt`,
        urlList: [...new Set(paths)].map((path) => `${origin}${path}`),
      }),
    });
    // 200 = recibido; 202 = recibido, la clave se valida después.
    if (response.status !== 200 && response.status !== 202) {
      console.error("[indexnow] Respuesta inesperada:", response.status, await response.text().catch(() => ""));
    }
  } catch (error) {
    console.error("[indexnow] No se pudo avisar:", error);
  }
}

/**
 * Un evento se publicó, cambió o se canceló: su ficha, el listado y las páginas de su estado y
 * municipio (mismas rutas que `Routes.events` en kadesh-landing).
 */
export async function submitPetEventToIndexNow(context: KeystoneContext, eventId: string): Promise<void> {
  if (!indexNowEnabled()) return;
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const event = await prisma.petEvent.findUnique({
      where: { id: eventId },
      select: { slug: true, stateCode: true, cityKey: true },
    });
    if (!event || event instanceof Error || !event.slug) return;
    const paths = [`/eventos/${event.slug}`, "/eventos"];
    const state = stateByCode(event.stateCode);
    if (state) {
      paths.push(`/eventos/en/${state.slug}`);
      if (event.cityKey) paths.push(`/eventos/en/${state.slug}/${event.cityKey}`);
    }
    await submitToIndexNow(paths);
  } catch (error) {
    console.error("[indexnow] No se pudo armar la lista del evento:", eventId, error);
  }
}
