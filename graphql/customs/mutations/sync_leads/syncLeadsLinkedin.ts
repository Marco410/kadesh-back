import { KeystoneContext } from "@keystone-6/core/types";

const APIFY_LEADS_FINDER_ACTOR = "code_crafter~leads-finder";
const APIFY_RUN_SYNC_DATASET_ITEMS_URL = `https://api.apify.com/v2/actors/${APIFY_LEADS_FINDER_ACTOR}/run-sync-get-dataset-items`;

/**
 * Filtros por defecto del actor leads-finder en Apify.
 * Ajusta estos valores o pásalos vía la mutación GraphQL.
 */
export const DEFAULT_LINKEDIN_LEAD_FILTERS = {
  company_industry: ["information technology & services"],
  company_keywords: ["gym"],
  contact_city: ["Morelia"],
  contact_job_title: ["software"],
  contact_location: ["mexico"],
  email_status: ["validated", "not_validated", "unknown"],
  fetch_count: 10,
  functional_level: ["c_suite"],
  min_revenue: "100K",
  seniority_level: ["founder"],
  size: ["1-10"],
} as const;

type ApifyLeadsFinderFilters = {
  company_industry?: string[];
  company_keywords?: string[];
  contact_city?: string[];
  contact_job_title?: string[];
  contact_location?: string[];
  email_status?: string[];
  fetch_count?: number;
  functional_level?: string[];
  min_revenue?: string;
  seniority_level?: string[];
  size?: string[];
  file_name?: string;
};

type SyncLeadsLinkedinInput = {
  company_industry?: string[];
  company_keywords?: string[];
  contact_city?: string[];
  contact_job_title?: string[];
  contact_location?: string[];
  email_status?: string[];
  fetch_count?: number;
  functional_level?: string[];
  min_revenue?: string;
  seniority_level?: string[];
  size?: string[];
  file_name?: string;
  filters?: Record<string, unknown>;
};

function buildApifyPayload(input?: SyncLeadsLinkedinInput): Record<string, unknown> {
  if (input?.filters && typeof input.filters === "object") {
    return {
      ...DEFAULT_LINKEDIN_LEAD_FILTERS,
      ...input.filters,
    };
  }

  const {
    company_industry,
    company_keywords,
    contact_city,
    contact_job_title,
    contact_location,
    email_status,
    fetch_count,
    functional_level,
    min_revenue,
    seniority_level,
    size,
    file_name,
  } = input ?? {};

  const overrides: ApifyLeadsFinderFilters = {
    ...(company_industry !== undefined && { company_industry }),
    ...(company_keywords !== undefined && { company_keywords }),
    ...(contact_city !== undefined && { contact_city }),
    ...(contact_job_title !== undefined && { contact_job_title }),
    ...(contact_location !== undefined && { contact_location }),
    ...(email_status !== undefined && { email_status }),
    ...(fetch_count !== undefined && { fetch_count }),
    ...(functional_level !== undefined && { functional_level }),
    ...(min_revenue !== undefined && { min_revenue }),
    ...(seniority_level !== undefined && { seniority_level }),
    ...(size !== undefined && { size }),
    ...(file_name !== undefined && { file_name }),
  };

  return {
    ...DEFAULT_LINKEDIN_LEAD_FILTERS,
    ...overrides,
  };
}

async function fetchLeadsFromApify(
  filters: Record<string, unknown>,
): Promise<{ items: unknown; rawText: string; status: number }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      "APIFY_API_TOKEN no está configurado. Agrégalo en config/.env.dev",
    );
  }

  const url = `${APIFY_RUN_SYNC_DATASET_ITEMS_URL}?token=${encodeURIComponent(token)}&format=json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });

  const rawText = await response.text();
  let items: unknown = null;

  try {
    items = rawText ? JSON.parse(rawText) : null;
  } catch {
    items = rawText;
  }

  if (!response.ok) {
    const detail =
      typeof items === "object" && items !== null
        ? JSON.stringify(items)
        : rawText;
    throw new Error(
      `Apify respondió ${response.status}: ${detail || response.statusText}`,
    );
  }

  return { items, rawText, status: response.status };
}

const typeDefs = `
  input SyncLeadsLinkedinInput {
    company_industry: [String!]
    company_keywords: [String!]
    contact_city: [String!]
    contact_job_title: [String!]
    contact_location: [String!]
    email_status: [String!]
    fetch_count: Int
    functional_level: [String!]
    min_revenue: String
    seniority_level: [String!]
    size: [String!]
    file_name: String
    filters: JSON
  }

  type SyncLeadsLinkedinResult {
    success: Boolean!
    message: String!
    filtersUsed: JSON!
    itemsCount: Int!
    items: JSON
    rawResponse: JSON
  }

  type Mutation {
    syncLeadsLinkedin(input: SyncLeadsLinkedinInput): SyncLeadsLinkedinResult!
  }
`;

const definition = `
  syncLeadsLinkedin(input: SyncLeadsLinkedinInput): SyncLeadsLinkedinResult!
`;

const resolver = {
  syncLeadsLinkedin: async (
    _root: unknown,
    { input }: { input?: SyncLeadsLinkedinInput },
    context: KeystoneContext,
  ) => {
    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;
    if (!userId) {
      return {
        success: false,
        message: "Debes iniciar sesión para sincronizar leads",
        filtersUsed: DEFAULT_LINKEDIN_LEAD_FILTERS,
        itemsCount: 0,
        items: null,
        rawResponse: null,
      };
    }

    const filtersUsed = buildApifyPayload(input);

    try {
      const { items, status } = await fetchLeadsFromApify(filtersUsed);
      const itemsArray = Array.isArray(items) ? items : items ? [items] : [];

      return {
        success: true,
        message: `Apify respondió ${status}. Se recibieron ${itemsArray.length} leads.`,
        filtersUsed,
        itemsCount: itemsArray.length,
        items,
        rawResponse: items,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error al consultar Apify",
        filtersUsed,
        itemsCount: 0,
        items: null,
        rawResponse: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
