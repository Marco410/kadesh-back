import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { KeystoneContext } from "@keystone-6/core/types";
import { STORE_PRODUCT_STATUS } from "../models/Pet/Store/constants";
import { storeCatalogVersion, storeEnabled } from "../utils/store/config";
import { storePrisma } from "../utils/store/catalog";
import { feedImageVersion, getFeedJpeg } from "../utils/store/feedImages";
import {
  META_FEED_CACHE_MS,
  META_FEED_PATH,
  STORE_MEDIA_PATH,
  buildMetaFeedRows,
  loadMetaFeedProducts,
  toMetaFeedCsv,
} from "../utils/store/metaFeed";

/**
 * Public routes for the Meta catalog of Kadesh Pet (see utils/store/metaFeed.ts):
 *
 * - `GET /feeds/meta/kadesh-pet.csv`: the product feed Meta downloads with a scheduled source.
 *   With `META_FEED_USER` and `META_FEED_PASSWORD` set it asks for Basic Auth; without them it is
 *   public. Kept in memory 15 min (rebuilt sooner after a catalog edit).
 * - `GET /media/store/<id>.jpg` (or `<id>`): a store photo as JPEG, answered directly (200, no
 *   redirect), for Meta, which takes only JPEG or PNG. Converted once and kept in R2 (see
 *   utils/store/feedImages.ts). One primary-key lookup per request; only photos of active products.
 */

/** The JPEG under a URL only changes with the photo (new ETag), so it can be cached a day. */
const MEDIA_MAX_AGE_S = 24 * 60 * 60;
const IMAGE_ID = /^[a-z0-9]{8,40}$/i;

let cached: { key: string; csv: string; at: number } | null = null;

/** Public base URL of this backend: `PUBLIC_BACKEND_URL`, else the host Meta called. */
function backendBaseUrl(req: Request): string {
  const configured = (process.env.PUBLIC_BACKEND_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

/** `true` when no credentials are configured, or the request carries the right ones. */
function isAuthorized(req: Request): boolean {
  const user = process.env.META_FEED_USER ?? "";
  const password = process.env.META_FEED_PASSWORD ?? "";
  if (!user || !password) return true;
  const header = req.headers.authorization ?? "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return false;
  const expected = sha256(`${user}:${password}`);
  const received = sha256(Buffer.from(match[1], "base64").toString("utf8"));
  return crypto.timingSafeEqual(expected, received);
}

async function buildCsv(context: KeystoneContext, baseUrl: string): Promise<string> {
  if (!storeEnabled()) return toMetaFeedCsv([]);
  const key = `${storeCatalogVersion()}|${baseUrl}`;
  const now = Date.now();
  if (cached && cached.key === key && now - cached.at < META_FEED_CACHE_MS) return cached.csv;

  const products = await loadMetaFeedProducts(context);
  const { rows, skipped, smallImages } = buildMetaFeedRows(products, { mediaBaseUrl: baseUrl });
  if (skipped.length > 0 || smallImages > 0) {
    console.info(
      `[meta feed] ${rows.length} rows; ${smallImages} photos under 500x500 left out; ` +
        `left out ${skipped.length} products:`,
      skipped.map((skip) => `${skip.productId} (${skip.reason})`).join(", ") || "none",
    );
  }
  const csv = toMetaFeedCsv(rows);
  cached = { key, csv, at: now };
  return csv;
}

async function handleFeed(req: Request, res: Response, context: KeystoneContext) {
  if (!isAuthorized(req)) {
    res.set("WWW-Authenticate", 'Basic realm="Kadesh Pet feed", charset="UTF-8"');
    res.status(401).send("Unauthorized");
    return;
  }
  const csv = await buildCsv(context, backendBaseUrl(req));
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Cache-Control", "public, max-age=900");
  res.set("Content-Disposition", 'inline; filename="kadesh-pet.csv"');
  res.status(200).send(csv);
}

async function handleMedia(req: Request, res: Response, context: KeystoneContext) {
  // `<id>` and `<id>.jpg` are the same photo; the feed uses the second.
  const imageId = String(req.params.file ?? "").replace(/\.jpe?g$/i, "");
  if (!IMAGE_ID.test(imageId) || !storeEnabled()) {
    res.sendStatus(404);
    return;
  }
  const row = await storePrisma(context).storeProductImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      image_id: true,
      image_extension: true,
      externalUrl: true,
      product: { select: { status: true } },
    },
  });
  if (row instanceof Error) throw row;
  if (!row || row.product?.status !== STORE_PRODUCT_STATUS.ACTIVE) {
    res.sendStatus(404);
    return;
  }

  const etag = `"${feedImageVersion(row)}"`;
  res.set("Cache-Control", `public, max-age=${MEDIA_MAX_AGE_S}`);
  res.set("ETag", etag);
  const ifNoneMatch = String(req.headers["if-none-match"] ?? "");
  if (ifNoneMatch.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag)) {
    res.status(304).end();
    return;
  }

  const jpeg = await getFeedJpeg(row);
  if (!jpeg) {
    res.removeHeader("Cache-Control");
    res.removeHeader("ETag");
    res.sendStatus(404);
    return;
  }
  res.set("Content-Type", "image/jpeg");
  res.set("Content-Length", String(jpeg.length));
  res.status(200).end(jpeg);
}

function run(
  label: string,
  handler: (req: Request, res: Response, context: KeystoneContext) => Promise<void>,
  req: Request,
  res: Response,
  context: KeystoneContext,
) {
  void handler(req, res, context).catch((error: unknown) => {
    console.error(`[meta feed] ${label} failed`, error);
    if (!res.headersSent) res.sendStatus(500);
  });
}

export default function registerMetaCatalogFeed(app: Express, context: KeystoneContext) {
  app.get(META_FEED_PATH, (req: Request, res: Response) => run("feed", handleFeed, req, res, context));
  app.get(`${STORE_MEDIA_PATH}/:file`, (req: Request, res: Response) =>
    run("media", handleMedia, req, res, context),
  );
}
