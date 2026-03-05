export function formatReviewTech(review: {
    author_name?: string;
    rating?: number;
    text?: string;
  }) {
    const author = review.author_name || "Anónimo";
    const rating = review.rating ?? 0;
    const text = (review.text || "").trim();
    return `⭐ ${rating} - ${author}: ${text}`;
  }
  