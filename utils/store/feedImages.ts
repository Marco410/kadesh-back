import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { readStorageObject, uploadBufferToStorage } from "../intregrations/s3Storage";

/**
 * JPEG copies of store photos for the Meta catalog, which only takes JPEG or PNG (at least
 * 500×500, at most 8 MB). Originals in R2 are often WebP.
 *
 * `/media/store/<StoreProductImage.id>.jpg` serves the copy. The first request converts the original
 * and saves it in R2 at `store/jpeg/<image id>-<version>.jpg`; later requests read that object, so a
 * photo is converted once. `version` changes when the photo is replaced, so a stale copy is never
 * served under the same id.
 */

/** Longest side of the JPEG copy: keeps it far below Meta's 8 MB. */
const FEED_IMAGE_MAX_PX = 2048;
const FEED_IMAGE_QUALITY = 85;
/** Largest original read into memory, and largest copy read back. */
const SOURCE_MAX_BYTES = 25 * 1024 * 1024;
const JPEG_MAX_BYTES = 8 * 1024 * 1024;
/** Conversions at once: each holds the decoded image in RAM. */
const MAX_CONCURRENT_CONVERSIONS = 2;
const LOCAL_IMAGES_DIR = path.resolve(process.cwd(), "public/images");

// One libvips thread and no libvips cache: Railway bills RAM per minute.
sharp.cache(false);
sharp.concurrency(1);

export type FeedImageSource = {
  id: string;
  image_id: string | null;
  image_extension: string | null;
  externalUrl: string | null;
};

function hasObjectStorage(): boolean {
  return Boolean(process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

/** Same `pathPrefix` as the `s3_store` storage in keystone.ts. */
function storePrefix(): string {
  return (process.env.ENVIROMENT ?? "").toUpperCase() === "DEV" ? "dev/store/" : "store/";
}

/** Changes when the photo behind the row changes. Also the ETag. */
export function feedImageVersion(row: FeedImageSource): string {
  return crypto
    .createHash("sha1")
    .update(`${row.image_id ?? ""}|${row.image_extension ?? ""}|${row.externalUrl ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

/** Any image sharp reads → JPEG on white (transparency flattened), EXIF rotation applied. */
export async function toFeedJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: FEED_IMAGE_MAX_PX, height: FEED_IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: FEED_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function readLocal(file: string, maxBytes: number): Promise<Buffer | null> {
  try {
    const stat = await fs.stat(file);
    if (stat.size > maxBytes) throw new Error(`[feed images] ${file} is larger than ${maxBytes} bytes`);
    return await fs.readFile(file);
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function downloadExternal(url: string): Promise<Buffer | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) return null;
  if (Number(response.headers.get("content-length")) > SOURCE_MAX_BYTES) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > SOURCE_MAX_BYTES) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Width and height of an image, read from its header. `null` when sharp cannot read it. */
export async function imageSize(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(buffer).metadata();
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

/** The original of a store photo (R2, local disk or its external URL), up to 25 MB. */
export async function loadStoreImageOriginal(row: FeedImageSource): Promise<Buffer | null> {
  if (row.image_id) {
    const file = `${row.image_id}.${row.image_extension || "jpg"}`;
    return hasObjectStorage()
      ? readStorageObject(`${storePrefix()}${file}`, SOURCE_MAX_BYTES)
      : readLocal(path.join(LOCAL_IMAGES_DIR, file), SOURCE_MAX_BYTES);
  }
  if (row.externalUrl) return downloadExternal(row.externalUrl);
  return null;
}

async function readCopy(name: string): Promise<Buffer | null> {
  return hasObjectStorage()
    ? readStorageObject(`${storePrefix()}jpeg/${name}`, JPEG_MAX_BYTES)
    : readLocal(path.join(LOCAL_IMAGES_DIR, "jpeg", name), JPEG_MAX_BYTES);
}

async function saveCopy(name: string, jpeg: Buffer): Promise<void> {
  if (hasObjectStorage()) {
    await uploadBufferToStorage({ buffer: jpeg, contentType: "image/jpeg", key: `${storePrefix()}jpeg/${name}` });
    return;
  }
  await fs.mkdir(path.join(LOCAL_IMAGES_DIR, "jpeg"), { recursive: true });
  await fs.writeFile(path.join(LOCAL_IMAGES_DIR, "jpeg", name), jpeg);
}

let running = 0;
const waiting: Array<() => void> = [];

async function withConversionSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_CONVERSIONS) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

/** Requests for the same photo while it converts share one conversion. Entries leave when done. */
const inFlight = new Map<string, Promise<Buffer | null>>();

/** JPEG copy of a store photo: from R2 when already converted, else converted and saved now. */
export async function getFeedJpeg(row: FeedImageSource): Promise<Buffer | null> {
  const name = `${row.id}-${feedImageVersion(row)}.jpg`;
  const pending = inFlight.get(name);
  if (pending) return pending;

  const work = (async () => {
    const cached = await readCopy(name);
    if (cached) return cached;
    const jpeg = await withConversionSlot(async () => {
      const original = await loadStoreImageOriginal(row);
      return original ? toFeedJpeg(original) : null;
    });
    if (!jpeg) return null;
    try {
      await saveCopy(name, jpeg);
    } catch (error) {
      console.error("[feed images] could not save JPEG copy:", name, error);
    }
    return jpeg;
  })();

  inFlight.set(name, work);
  try {
    return await work;
  } finally {
    inFlight.delete(name);
  }
}
