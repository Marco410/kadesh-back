import { formatReviewTech } from "./format_review_tech";


const MIN_POSITIVE_REVIEW_RATING = 4;
const PROMPT_PREFIX = "";

export function buildReviewsAndPrompt(
    details: {
      name?: string;
      formatted_address?: string;
      formatted_phone_number?: string;
      website?: string;
      rating?: number;
      user_ratings_total?: number;
      reviews?: Array<{ author_name?: string; rating?: number; text?: string }>;
    },
    category: string,
  ): { topReviews: string[]; websitePromptContent: string } {
    const positiveReviews = (details.reviews || [])
      .filter(
        (r) =>
          (r.rating ?? 0) >= MIN_POSITIVE_REVIEW_RATING && (r.text || "").trim(),
      )
      .slice(0, 5)
      .map(formatReviewTech);
  
    const topReviews = [
      positiveReviews[0] || "",
      positiveReviews[1] || "",
      positiveReviews[2] || "",
      positiveReviews[3] || "",
      positiveReviews[4] || "",
    ];
  
    const lines = [
      `Negocio: ${details.name || ""}`,
      `Categoría: ${category}`,
      `Dirección: ${details.formatted_address || ""}`,
      `Teléfono: ${details.formatted_phone_number || ""}`,
      `Sitio web actual: ${details.website ? "Sí" : "No tiene"}`,
      `Valoración: ${details.rating ?? "-"} (${details.user_ratings_total ?? 0} reseñas)`,
      "",
      "Reseñas positivas de Google:",
      ...positiveReviews.map((r) => `- ${r}`),
    ];
    const businessInfo = lines.join("\n");
    const websitePromptContent = PROMPT_PREFIX + businessInfo;
  
    return { topReviews, websitePromptContent };
  }