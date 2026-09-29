import type { Product } from "../constants/product";
import { PRODUCT } from "../constants/product";

const LINKEDIN_API_VERSION =
  process.env.LINKEDIN_API_VERSION?.trim() || "202401";

type LinkedInPageEnv = {
  organizationId: string | undefined;
  accessToken: string | undefined;
};

function linkedInPageEnv(product: Product): LinkedInPageEnv {
  if (product === PRODUCT.SAAS) {
    return {
      organizationId: process.env.LINKEDIN_SAAS_ORGANIZATION_ID?.trim(),
      accessToken: process.env.LINKEDIN_SAAS_ACCESS_TOKEN?.trim(),
    };
  }
  return {
    organizationId: process.env.LINKEDIN_PET_ORGANIZATION_ID?.trim(),
    accessToken: process.env.LINKEDIN_PET_ACCESS_TOKEN?.trim(),
  };
}

/** `product` debe ser `pet` o `saas` (una Company Page real), nunca `all`: eso lo resuelve el caller. */
export function isLinkedInConfigured(product: Product): boolean {
  const { organizationId, accessToken } = linkedInPageEnv(product);
  return Boolean(organizationId && accessToken);
}

type LinkedInErrorBody = {
  message?: string;
  status?: number;
  code?: string;
};

/**
 * Publica en el feed de la Company Page de LinkedIn de `product` (REST Posts API).
 * Incluye `content.article` con la URL del blog para que LinkedIn arme la card.
 * No lanza si falta configuración (solo warnea y no hace nada); sí lanza si la llamada falla.
 */
export async function postToLinkedInPage({
  product,
  message,
  link,
  title,
}: {
  product: Product;
  message: string;
  link: string;
  title: string;
}): Promise<{ id: string } | undefined> {
  const { organizationId, accessToken } = linkedInPageEnv(product);

  if (!organizationId || !accessToken) {
    console.warn(
      `[linkedin] Página de "${product}" no configurada (LINKEDIN_${product.toUpperCase()}_ORGANIZATION_ID / _ACCESS_TOKEN). Post no publicado.`,
    );
    return undefined;
  }

  const payload = {
    author: `urn:li:organization:${organizationId}`,
    commentary: message,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      article: {
        source: link,
        title,
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let parsed: (LinkedInErrorBody & { id?: string }) | null = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }

  const postId =
    response.headers.get("x-restli-id") ||
    response.headers.get("x-linkedin-id") ||
    parsed?.id;

  if (!response.ok || !postId) {
    const detail = parsed?.message || bodyText || `HTTP ${response.status}`;
    throw new Error(`[linkedin] API error (${product}): ${detail}`);
  }

  return { id: postId };
}
