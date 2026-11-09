import type { IncomingMessage } from "http";
import { BlockList, isIP } from "net";
import { requestIp, requestUserAgent } from "../activity/requestMeta";

/**
 * Crawlers de vista previa de enlaces y buscadores. Abren las páginas con navegadores headless
 * sin GPU ni sesión, y lo que les falla (p. ej. el mapa sin WebGL en la ficha de un animal) no le
 * pasó a una persona: `trackEvents` no guarda sus `app.client_error`.
 *
 * El crawler de Meta llega a veces con un user agent de Chrome normal ("Chrome/139", Windows),
 * así que además del user agent se revisa la IP contra los rangos de Meta (AS32934).
 *
 * Rangos tomados como indica la guía del crawler de Meta y agregados (sin duplicados ni
 * subredes contenidas) el 2026-11-09:
 *   whois -h whois.radb.net -- '-i origin AS32934' | grep ^route
 * Si Meta suma rangos, vuelve a correrlo y actualiza las listas.
 */

const META_IPV4 = [
  "31.13.24.0/21",
  "31.13.64.0/18",
  "45.64.40.0/22",
  "57.141.0.0/20",
  "57.141.16.0/21",
  "57.141.24.0/22",
  "57.141.28.0/23",
  "57.144.0.0/14",
  "66.220.144.0/20",
  "69.63.176.0/20",
  "69.171.224.0/19",
  "74.119.76.0/22",
  "102.132.96.0/20",
  "103.4.96.0/22",
  "129.134.0.0/16",
  "147.75.208.0/20",
  "157.240.0.0/16",
  "163.70.128.0/17",
  "163.77.128.0/17",
  "173.252.64.0/18",
  "179.60.192.0/22",
  "185.60.216.0/22",
  "185.89.216.0/22",
  "204.15.20.0/22",
];

const META_IPV6 = [
  "2401:db00::/32",
  "2620:0:1c00::/40",
  "2803:6080::/29",
  "2a03:2880::/31",
  "2a03:2887:ff2c::/47",
  "2a03:83e0::/32",
  "2a10:f781:10:cee0::/64",
];

/**
 * Crawlers y vistas previas por user agent. No incluye el navegador interno de Facebook o
 * Instagram (`FBAN`, `FB_IAB`, `Instagram`): esos sí son personas.
 */
const BOT_USER_AGENT =
  /facebookexternalhit|facebookcatalog|facebot|meta-externalagent|meta-externalfetcher|meta-webindexer|whatsapp|twitterbot|slackbot|telegrambot|linkedinbot|discordbot|pinterestbot|googlebot|google-inspectiontool|adsbot-google|mediapartners-google|storebot-google|bingbot|yandexbot|baiduspider|duckduckbot|applebot|petalbot|ahrefsbot|semrushbot|headlesschrome|chrome-lighthouse/i;

const metaRanges = new BlockList();
for (const [ranges, family] of [
  [META_IPV4, "ipv4"],
  [META_IPV6, "ipv6"],
] as const) {
  for (const cidr of ranges) {
    const [network, prefix] = cidr.split("/");
    metaRanges.addSubnet(network, Number(prefix), family);
  }
}

/** La IP es de Meta (sus crawlers de vista previa y de IA salen de estos rangos). */
export function isMetaIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const family = isIP(ip);
  if (family === 4) return metaRanges.check(ip, "ipv4");
  if (family === 6) return metaRanges.check(ip, "ipv6");
  return false;
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && BOT_USER_AGENT.test(userAgent));
}

/** La petición viene de un crawler conocido: por user agent o por IP de Meta. */
export function isKnownCrawlerRequest(req?: IncomingMessage | null): boolean {
  if (!req) return false;
  return isBotUserAgent(requestUserAgent(req)) || isMetaIp(requestIp(req));
}
