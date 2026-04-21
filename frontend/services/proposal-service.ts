import { apiClient } from "./api-client";

export interface Proposal {
  id: string;
  display_id?: string;
  request_id: string;
  provider_id: string;
  price: number;
  message: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  updated_at: string;
  provider?: { id: string; name: string; rating: number; review_count: number };
  estimated_hours?: number;
  start_date?: string;
  completion_date?: string;
  rejected_reason?: string;
}

export interface CreateProposalData {
  request_id?: string;
  provider_id?: string;
  price: number;
  message: string;
  estimated_hours?: number;
  start_date?: string;
  completion_date?: string;
}

export interface UpdateProposalData {
  price?: number;
  estimated_hours?: number;
  message?: string;
}

class ProposalService {
  async createProposal(
    requestId: string,
    data: CreateProposalData,
  ): Promise<Proposal> {
    const response = await apiClient.post<Proposal>(
      `/requests/${requestId}/proposals`,
      data,
    );
    return response.data;
  }

  async getProposalsByRequest(requestId: string): Promise<Proposal[]> {
    const response = await apiClient.get<any>(
      `/requests/${requestId}/proposals`,
    );
    return apiClient.extractList<Proposal>(response.data);
  }

  async getProposalById(id: string): Promise<Proposal> {
    const response = await apiClient.get<Proposal>(`/proposals/${id}`);
    return response.data;
  }

  async updateProposal(
    id: string,
    data: UpdateProposalData,
  ): Promise<Proposal> {
    const response = await apiClient.patch<Proposal>(`/proposals/${id}`, data);
    return response.data;
  }

  async acceptProposal(id: string): Promise<Proposal> {
    const response = await apiClient.post<Proposal>(
      `/proposals/${id}/accept`,
      {},
    );
    return response.data;
  }

  async rejectProposal(id: string): Promise<Proposal> {
    const response = await apiClient.post<Proposal>(
      `/proposals/${id}/reject`,
      {},
    );
    return response.data;
  }

  async withdrawProposal(id: string): Promise<Proposal> {
    const response = await apiClient.post<Proposal>(
      `/proposals/${id}/withdraw`,
      {},
    );
    return response.data;
  }

  async getMyProposals(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }): Promise<{ data: Proposal[]; total: number; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.status) qs.append("status", params.status);
    if (params?.sort_by) qs.append("sort_by", params.sort_by);
    if (params?.sort_order) qs.append("sort_order", params.sort_order);
    const query = qs.toString();
    const response = await apiClient.get<any>(`/proposals/my${query ? `?${query}` : ""}`);
    const envelope = response.data;
    const inner = envelope?.data ?? envelope;
    if (inner && typeof inner === "object" && "data" in inner && "total" in inner) {
      return {
        data: Array.isArray(inner.data) ? inner.data : [],
        total: inner.total ?? 0,
        page: inner.page ?? (params?.page ?? 1),
        limit: inner.limit ?? (params?.limit ?? 20),
      };
    }
    const list = apiClient.extractList<Proposal>(envelope);
    return { data: list, total: list.length, page: 1, limit: list.length };
  }

  async getMyProposalsList(): Promise<Proposal[]> {
    const result = await this.getMyProposals({ limit: 200 });
    return result.data;
  }
}

export const proposalService = new ProposalService();
