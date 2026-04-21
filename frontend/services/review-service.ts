import { apiClient } from "./api-client";

// ------------------ Types ------------------

export interface Review {
  id: string;
  display_id?: string;
  job_id: string;
  user_id: string;
  provider_id: string;
  rating: number;
  comment: string;
  created_at: string;
  response?: string;
  response_at?: string;
  helpful_count?: number;
  verified_purchase?: boolean;
}

export interface CreateReviewData {
  job_id: string;
  provider_id: string;
  rating: number;
  comment: string;
}

export interface ReviewWithDetails extends Review {
  customer_name?: string;
  customer_email?: string;
  job_title?: string;
}

// ------------------ API Methods ------------------

/**
 * Create a review after job completion
 */
export const createReview = async (data: CreateReviewData): Promise<Review> => {
  const response = await apiClient.post<Review>("/reviews", data);
  return response.data;
};

/**
 * Get reviews for a provider
 * Backend returns: { success, data: { reviews[], averageRating }, meta }
 */
export const getProviderReviews = async (
  providerId: string,
): Promise<ReviewWithDetails[]> => {
  const response = await apiClient.get<any>(`/reviews/provider/${providerId}`);
  // After apiClient unwraps the standard envelope, data is { reviews: [], averageRating: N }
  const payload = response.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.reviews)) return payload.reviews;
  if (Array.isArray(payload?.data?.reviews)) return payload.data.reviews;
  return [];
};

/**
 * Get a specific review by ID
 */
export const getReview = async (reviewId: string): Promise<Review> => {
  const response = await apiClient.get<Review>(`/reviews/${reviewId}`);
  return response.data;
};

/**
 * Get reviews for a job
 */
export const getJobReview = async (jobId: string): Promise<Review | null> => {
  const response = await apiClient.get<Review>(`/reviews/jobs/${jobId}/review`);
  return response.data;
};

// ------------------ Review Aggregates ------------------

export interface ReviewAggregate {
  provider_id: string;
  total_reviews: number;
  average_rating: number;
  five_star_count: number; // Transformed from rating_5_count
  four_star_count: number; // Transformed from rating_4_count
  three_star_count: number; // Transformed from rating_3_count
  two_star_count: number; // Transformed from rating_2_count
  one_star_count: number; // Transformed from rating_1_count
  last_review_at?: string;
  updated_at?: string; // From database updated_at
}

/**
 * Get review aggregates for a provider
 */
export const getProviderReviewAggregates = async (
  providerId: string,
): Promise<ReviewAggregate> => {
  const response = await apiClient.get<any>(
    `/review-aggregates/provider/${providerId}`,
  );
  // apiClient.get returns the full axios response; response.data is the standard
  // envelope { success, statusCode, message, data: {...}, meta? }.
  // We extract the inner data object and coerce string numbers to actual numbers.
  const payload = response.data;
  const raw = payload?.data ?? payload;
  return {
    ...raw,
    average_rating: typeof raw.average_rating === "string"
      ? parseFloat(raw.average_rating)
      : (raw.average_rating ?? 0),
    // Normalise aliased fields (backend returns both rating_N_count & N_star_count)
    five_star_count: raw.five_star_count ?? raw.rating_5_count ?? 0,
    four_star_count: raw.four_star_count ?? raw.rating_4_count ?? 0,
    three_star_count: raw.three_star_count ?? raw.rating_3_count ?? 0,
    two_star_count: raw.two_star_count ?? raw.rating_2_count ?? 0,
    one_star_count: raw.one_star_count ?? raw.rating_1_count ?? 0,
  } as ReviewAggregate;
};

const reviewService = {
  createReview,
  getProviderReviews,
  getReview,
  getJobReview,
  getProviderReviewAggregates,
  getMyReviews: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: ReviewWithDetails[]; total: number }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    const response = await apiClient.get<any>(`/reviews/my?${qs.toString()}`);
    const raw = response.data;
    if (Array.isArray(raw)) return { data: raw, total: raw.length };
    return { data: raw?.data ?? [], total: raw?.total ?? 0 };
  },
};

export default reviewService;
