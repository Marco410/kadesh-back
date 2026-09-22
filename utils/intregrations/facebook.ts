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

/** `product` debe ser `pet` o `saas` (una Página real), nunca `all`: eso lo resuelve el caller. */
export function isFacebookConfigured(product: Product): boolean {
  const { pageId, accessToken } = facebookPageEnv(product);
  return Boolean(pageId && accessToken);
}

type FacebookGraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
};

/**
 * Publica en el feed de la Página de Facebook de `product` (Graph API). Facebook scrapea el
 * Open Graph de `link` solo (título/imagen/descripción) — no hace falta mandarlos aparte.
 * No lanza si falta configuración (solo warnea y no hace nada); sí lanza si la llamada falla.
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
  const { pageId, accessToken } = facebookPageEnv(product);

  if (!pageId || !accessToken) {
    console.warn(
      `[facebook] Página de "${product}" no configurada (FACEBOOK_${product.toUpperCase()}_PAGE_ID / _ACCESS_TOKEN). Post no publicado.`,
    );
    return undefined;
  }

  const body = new URLSearchParams({ message, link, access_token: accessToken });

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const bodyText = await response.text();
  let parsed: (FacebookGraphErrorBody & { id?: string }) | null = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed?.id) {
    const detail = parsed?.error?.message || bodyText || `HTTP ${response.status}`;
    throw new Error(`[facebook] Graph API error (${product}): ${detail}`);
  }

  return { id: parsed.id };
}
