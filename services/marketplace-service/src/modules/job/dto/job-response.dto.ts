import { Job } from "../entities/job.entity";

/** Computed pricing breakdown attached by the service layer. */
export interface PriceBreakdown {
  base_amount: number;
  urgency_level: string;
  urgency_surcharge_percent: number;
  urgency_surcharge: number;
  subtotal: number;
  platform_fee_percent: number;
  platform_fee: number;
  provider_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_payable: number;
}

export class JobResponseDto {
  id: string;
  display_id?: string;
  request_id: string;
  provider_id: string;
  customer_id: string;
  proposal_id?: string;
  actual_amount?: number;
  cancellation_reason?: string;
  status: string;
  started_at?: Date;
  completed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
  // Customer
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  // Provider
  provider_name?: string | null;
  provider_email?: string | null;
  provider_business_name?: string | null;
  provider_rating?: number | null;
  provider_verification_status?: string | null;
  // Request
  request_description?: string | null;
  request_budget?: number | null;
  request_status?: string | null;
  request_urgency?: string | null;
  request_preferred_date?: Date | null;
  request_category_name?: string | null;
  request_category_icon?: string | null;
  // Proposal
  proposal_price?: number | null;
  proposal_message?: string | null;
  proposal_estimated_hours?: number | null;
  proposal_start_date?: Date | null;
  proposal_completion_date?: Date | null;
  // Computed pricing
  price_breakdown?: PriceBreakdown | null;

  static fromEntity(job: Job): JobResponseDto {
    return {
      id: job.id,
      display_id: job.display_id,
      request_id: job.request_id,
      provider_id: job.provider_id,
      customer_id: job.customer_id,
      proposal_id: job.proposal_id,
      actual_amount: job.actual_amount,
      cancellation_reason: job.cancellation_reason,
      status: job.status,
      started_at: job.started_at,
      completed_at: job.completed_at,
      created_at: job.created_at,
      updated_at: job.updated_at,
      customer_name: job.customer_name ?? null,
      customer_email: job.customer_email ?? null,
      customer_phone: job.customer_phone ?? null,
      provider_name: job.provider_name ?? null,
      provider_email: job.provider_email ?? null,
      provider_business_name: job.provider_business_name ?? null,
      provider_rating: job.provider_rating ?? null,
      provider_verification_status: job.provider_verification_status ?? null,
      request_description: job.request_description ?? null,
      request_budget: job.request_budget ?? null,
      request_status: job.request_status ?? null,
      request_urgency: job.request_urgency ?? null,
      request_preferred_date: job.request_preferred_date ?? null,
      request_category_name: job.request_category_name ?? null,
      request_category_icon: job.request_category_icon ?? null,
      proposal_price: job.proposal_price ?? null,
      proposal_message: job.proposal_message ?? null,
      proposal_estimated_hours: job.proposal_estimated_hours ?? null,
      // Fall back to the job's own timestamps when the provider didn't set dates
      proposal_start_date: job.proposal_start_date ?? job.started_at ?? null,
      proposal_completion_date:
        job.proposal_completion_date ?? job.completed_at ?? null,
      price_breakdown: null,
    };
  }
}

export class PaginatedJobResponseDto {
  data: JobResponseDto[];
  total?: number;
  page?: number;
  limit?: number;
  nextCursor?: string;
  hasMore?: boolean;

  constructor(
    data: JobResponseDto[],
    nextCursor?: string,
    hasMore = false,
    total?: number,
    page?: number,
    limit?: number,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
  }
}
