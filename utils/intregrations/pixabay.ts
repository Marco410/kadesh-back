/**
 * Búsqueda en Pixabay. La API key va en la query string: los logs solo llevan `q` y el status,
 * nunca la URL. Si falta `PIXABAY_API_KEY`, avisa y no busca. Un fallo de red, 429 o 5xx
 * no lanza: devuelve null.
 */

const PIXABAY_API = "https://pixabay.com/api/";
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_IMAGE_WIDTH = 1200;
const MIN_WEBFORMAT_WIDTH = 640;

export type PixabayCredit = {
  user: string;
  pageURL: string;
};

export type PixabayPhoto = {
  buffer: Buffer;
  credit: PixabayCredit;
};

type PixabayHit = {
  imageWidth?: number;
  largeImageURL?: string;
  webformatURL?: string;
  webformatWidth?: number;
  user?: string;
  pageURL?: string;
};

function apiKey(): string | undefined {
  const value = process.env.PIXABAY_API_KEY?.trim();
  return value || undefined;
}

function redact(text: string): string {
  return text.replace(/key=[^&\s]+/gi, "key=***");
}

function clip(text: string, max = 200): string {
  const trimmed = redact(text).replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > maxBytes ? null : buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function downloadImage(url: string, query: string, maxBytes: number): Promise<Buffer | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[pixabay] no se pudo descargar la foto (q="${query}", status=${response.status})`);
      return null;
    }
    return await readLimited(response, maxBytes);
  } catch (err) {
    const detail = err instanceof Error ? clip(err.message) : "error de red";
    console.error(`[pixabay] no se pudo descargar la foto (q="${query}"): ${detail}`);
    return null;
  }
}

/**
 * Primer hit horizontal con `imageWidth` >= 1200. Baja `largeImageURL` y, si esa URL falla,
 * `webformatURL` solo cuando mide al menos 640 px de ancho. `accept` dice si el buffer
 * sirve como portada (jpg, png o webp, hasta 8 MB).
 */
export async function findPixabayPhoto(
  query: string,
  options: { maxBytes: number; accept: (buffer: Buffer) => boolean },
): Promise<PixabayPhoto | null> {
  const key = apiKey();
  if (!key) {
    console.warn("[pixabay] PIXABAY_API_KEY no configurado. No se busca foto.");
    return null;
  }

  const params = new URLSearchParams({
    key,
    q: query,
    image_type: "photo",
    orientation: "horizontal",
    safesearch: "true",
    min_width: String(MIN_IMAGE_WIDTH),
    per_page: "10",
    order: "popular",
    lang: "en",
  });

  let hits: PixabayHit[];
  try {
    const response = await fetchWithTimeout(`${PIXABAY_API}?${params}`);
    const bodyText = await response.text();
    if (!response.ok) {
      console.error(
        `[pixabay] búsqueda falló (q="${query}", status=${response.status}): ${clip(bodyText) || "sin detalle"}`,
      );
      return null;
    }
    const parsed = bodyText ? (JSON.parse(bodyText) as { hits?: PixabayHit[] }) : {};
    hits = Array.isArray(parsed.hits) ? parsed.hits : [];
  } catch (err) {
    const detail = err instanceof Error ? clip(err.message) : "error de red";
    console.error(`[pixabay] búsqueda falló (q="${query}"): ${detail}`);
    return null;
  }

  const hit = hits.find((item) => (item.imageWidth ?? 0) >= MIN_IMAGE_WIDTH);
  const urls = [
    hit?.largeImageURL,
    (hit?.webformatWidth ?? 0) >= MIN_WEBFORMAT_WIDTH ? hit?.webformatURL : undefined,
  ].filter((url): url is string => Boolean(url));
  if (!hit || urls.length === 0) {
    console.error(`[pixabay] ningún resultado sirve (q="${query}")`);
    return null;
  }

  for (const url of urls) {
    const buffer = await downloadImage(url, query, options.maxBytes);
    if (!buffer || !options.accept(buffer)) continue;
    return {
      buffer,
      credit: {
        user: hit.user?.trim() || "Pixabay",
        pageURL: hit.pageURL?.trim() || "https://pixabay.com",
      },
    };
  }

  console.error(`[pixabay] no se pudo usar la foto (q="${query}")`);
  return null;
}
