export class Job {
  id: string;
  display_id: string;
  request_id: string;
  provider_id: string;
  customer_id: string;
  proposal_id?: string;
  actual_amount?: number;
  cancelled_by?: string;
  cancellation_reason?: string;
  status: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
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
}
