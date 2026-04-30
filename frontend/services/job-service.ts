import { apiClient } from "./api-client";

export interface Job {
  id: string;
  display_id?: string;
  request_id: string;
  proposal_id?: string;
  customer_id: string;
  provider_id: string;
  status:
    | "pending"
    | "scheduled"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "disputed";
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
  actual_amount?: number;
  cancelled_by?: string;
  cancellation_reason?: string;
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
  request_preferred_date?: string | null;
  request_category_name?: string | null;
  request_category_icon?: string | null;
  // Proposal
  proposal_price?: number | null;
  proposal_message?: string | null;
  proposal_estimated_hours?: number | null;
  proposal_start_date?: string | null;
  proposal_completion_date?: string | null;
  // Computed pricing breakdown from backend
  price_breakdown?: {
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
  } | null;
  // Legacy nested shapes (list endpoint may still return these)
  request?: { id?: string; description?: string };
  proposal?: { id?: string; message?: string };
  provider?: {
    id?: string;
    name?: string;
    business_name?: string;
    rating?: number;
    user?: { name?: string };
  };
  customer?: { id?: string; name?: string; email?: string };
}

export interface CreateJobData {
  request_id: string;
  proposal_id: string;
  provider_id: string;
  actual_amount?: number;
}

export interface UpdateJobStatusData {
  status: Job["status"];
  notes?: string;
}

class JobService {
  async createJob(data: CreateJobData): Promise<Job> {
    const response = await apiClient.post<Job>("/jobs", data);
    return response.data;
  }

  async getJobById(id: string): Promise<Job> {
    const response = await apiClient.get<Job>(`/jobs/${id}`);
    return response.data;
  }

  async updateJobStatus(id: string, data: UpdateJobStatusData): Promise<Job> {
    const response = await apiClient.patch<Job>(`/jobs/${id}/status`, data);
    return response.data;
  }

  async startJob(id: string): Promise<Job> {
    const response = await apiClient.patch<Job>(`/jobs/${id}/status`, {
      status: "in_progress",
    });
    return response.data;
  }

  async completeJob(id: string): Promise<Job> {
    const response = await apiClient.patch<Job>(`/jobs/${id}/status`, {
      status: "completed",
    });
    return response.data;
  }

  /** Customer-facing complete — calls the dedicated endpoint that requires payment to be confirmed. */
  async completeJobByCustomer(id: string): Promise<Job> {
    const response = await apiClient.post<Job>(`/jobs/${id}/complete`);
    return response.data;
  }

  async cancelJob(id: string, reason?: string): Promise<Job> {
    const response = await apiClient.delete<Job>(`/jobs/${id}`, {
      data: { reason: reason || "Cancelled by user" },
    });
    return response.data;
  }

  async getMyJobs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    sort_by?: string;
    sort_order?: "asc" | "desc";
    search?: string;
  }): Promise<{ data: Job[]; total: number; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.status) qs.append("status", params.status);
    const sortBy = params?.sortBy ?? params?.sort_by;
    const sortOrder = params?.sortOrder ?? params?.sort_order;
    if (sortBy) qs.append("sortBy", sortBy);
    if (sortOrder) qs.append("sortOrder", sortOrder);
    const query = qs.toString();
    const response = await apiClient.get<any>(`/jobs/my${query ? `?${query}` : ""}`);
    const envelope = response.data;
    // Handle standard paginated envelope { success, data: { data: [], total } }
    const inner = envelope?.data ?? envelope;
    if (inner && typeof inner === "object" && "data" in inner && "total" in inner) {
      return {
        data: Array.isArray(inner.data) ? inner.data : [],
        total: inner.total ?? 0,
        page: inner.page ?? (params?.page ?? 1),
        limit: inner.limit ?? (params?.limit ?? 20),
      };
    }
    // Fallback for non-paginated array response
    const list = apiClient.extractList<Job>(envelope);
    return { data: list, total: list.length, page: 1, limit: list.length };
  }

  async getMyJobsList(): Promise<Job[]> {
    const result = await this.getMyJobs({ limit: 100 });
    return result.data;
  }

  async getJobsByStatus(status: Job["status"]): Promise<Job[]> {
    const response = await apiClient.get<any>(`/jobs?status=${status}`);
    return apiClient.extractList<Job>(response.data);
  }
}

export const jobService = new JobService();
