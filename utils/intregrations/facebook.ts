import type { Product } from "../constants/product";
import { PRODUCT } from "../constants/product";

const GRAPH_API_VERSION =
  process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v21.0";

type FacebookPageEnv = {
  pageId: string | undefined;
  accessToken: string | undefined;
};

function facebookPageEnv(product: Product): FacebookPageEnv {
  if (product === PRODUCT.SAAS) {
    return {
      pageId: process.env.FACEBOOK_SAAS_PAGE_ID?.trim(),
      accessToken: process.env.FACEBOOK_SAAS_PAGE_ACCESS_TOKEN?.trim(),
    };
  }
  return {
    pageId: process.env.FACEBOOK_PET_PAGE_ID?.trim(),
    accessToken: process.env.FACEBOOK_PET_PAGE_ACCESS_TOKEN?.trim(),
  };
}

/**
 * Con `ENVIROMENT=DEV` nunca se publica: las Páginas y tokens son los mismos de producción,
 * así que un post de prueba saldría al público.
 */
export function isFacebookPostingDisabled(): boolean {
  return (process.env.ENVIROMENT ?? "").trim().toUpperCase() === "DEV";
}

/** `product` debe ser `pet` o `saas` (una Página real), nunca `all`: eso lo resuelve el caller. */
export function isFacebookConfigured(product: Product): boolean {
  const { pageId, accessToken } = facebookPageEnv(product);
  return Boolean(pageId && accessToken);
}

type FacebookGraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
};

type FacebookGraphBody = FacebookGraphErrorBody & { id?: string; success?: boolean };

/**
 * Llama a la Graph API con el token de la Página de `product` y devuelve el cuerpo ya leído.
 * `undefined` si es DEV o falta configuración (solo avisa); lanza si la llamada falla.
 */
async function graphRequest({
  product,
  method,
  path,
  params = {},
  action,
}: {
  product: Product;
  method: "POST" | "DELETE";
  path: string;
  params?: Record<string, string>;
  /** Para los avisos: «publica», «comenta»… */
  action: string;
}): Promise<FacebookGraphBody | undefined> {
  if (isFacebookPostingDisabled()) {
    console.log(`[facebook] ENVIROMENT=DEV: no se ${action} en la Página de "${product}".`);
    return undefined;
  }

  const { pageId, accessToken } = facebookPageEnv(product);

  if (!pageId || !accessToken) {
    console.warn(
      `[facebook] Página de "${product}" no configurada (FACEBOOK_${product.toUpperCase()}_PAGE_ID / _ACCESS_TOKEN). No se ${action}.`,
    );
    return undefined;
  }

  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const target = path.replace("{pageId}", pageId);

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${target}`, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const bodyText = await response.text();
  let parsed: FacebookGraphBody | null = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed || parsed.error) {
    const detail = parsed?.error?.message || bodyText || `HTTP ${response.status}`;
    throw new Error(`[facebook] Graph API error (${product}): ${detail}`);
  }

  return parsed;
}

/**
 * Publica en el feed de la Página de Facebook de `product` (Graph API). Facebook scrapea el
 * Open Graph de `link` solo (título/imagen/descripción) — no hace falta mandarlos aparte.
 * No lanza si falta configuración o si es DEV (solo avisa y no hace nada); sí lanza si la
 * llamada falla.
 */
export async function postToFacebookPage({
  product,
  message,
  link,
}: {
  product: Product;
  message: string;
  link: string;
}): Promise<{ id: string } | undefined> {
  const parsed = await graphRequest({
    product,
    method: "POST",
    path: "{pageId}/feed",
    params: { message, link },
    action: "publica",
  });
  if (!parsed) return undefined;
  if (!parsed.id) throw new Error(`[facebook] Graph API error (${product}): respuesta sin id`);
  return { id: parsed.id };
}

/**
 * Comenta como la Página en un post suyo (`postId` = el que guardó `postToFacebookPage`). El token
 * necesita `pages_manage_engagement`. Mismas reglas que publicar: DEV o sin configurar no hace nada.
 */
export async function commentOnFacebookPost({
  product,
  postId,
  message,
}: {
  product: Product;
  postId: string;
  message: string;
}): Promise<{ id: string } | undefined> {
  const parsed = await graphRequest({
    product,
    method: "POST",
    path: `${encodeURIComponent(postId)}/comments`,
    params: { message },
    action: "comenta",
  });
  if (!parsed) return undefined;
  if (!parsed.id) throw new Error(`[facebook] Graph API error (${product}): respuesta sin id`);
  return { id: parsed.id };
}

/** Borra un post o comentario de la Página. DEV o sin configurar no hace nada. */
export async function deleteFacebookObject({
  product,
  objectId,
}: {
  product: Product;
  objectId: string;
}): Promise<void> {
  await graphRequest({
    product,
    method: "DELETE",
    path: encodeURIComponent(objectId),
    action: "borra",
  });
}
