import { apiClient } from "./api-client";
import type { RequestImage } from "./file-service";

export type { RequestImage };

export interface ServiceCategory {
  id: string;
  display_id?: string;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  display_id?: string;
  user_id?: string | null;
  user_name?: string | null;
  category_id: string;
  description: string;
  budget: number;
  status: "open" | "assigned" | "completed" | "cancelled";
  // Guest information for anonymous requests
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; icon?: string };
  location_id?: string;
  location?: {
    id: string;
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;   // sent to API; backend stores as zip_code
    zip_code?: string;  // returned from API in responses
    country?: string;
  };
  images?: RequestImage[];
  preferred_date?: string;
  urgency?: "low" | "medium" | "high" | "urgent";
  expiry_date?: string;
  view_count?: number;
  proposal_count?: number;
  deleted_at?: string;
}

export interface CreateRequestData {
  category_id: string;
  description: string;
  budget: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  /** File objects to upload — backend handles file-service upload internally */
  imageFiles?: File[];
  preferred_date?: string;
  urgency?: "low" | "medium" | "high" | "urgent";
  expiry_date?: string;
  guest_info?: { name: string; email: string; phone: string };
  user_id?: string;
}

export interface UpdateRequestData {
  category_id?: string;
  description?: string;
  budget?: number;
  status?: ServiceRequest["status"];
}

// Paginated response from API (standardized format)
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  cursor?: string;
  hasMore?: boolean;
}

export interface RequestFilters {
  status?: string;
  category_id?: string;
  min_budget?: number;
  max_budget?: number;
  cursor?: string;
  limit?: number;
  page?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

class RequestService {
  async createRequest(data: CreateRequestData): Promise<ServiceRequest> {
    const { imageFiles, ...rest } = data;

    if (imageFiles && imageFiles.length > 0) {
      // Send as multipart/form-data so the backend uploads images internally
      const formData = new FormData();

      // Append non-file fields as JSON string so the backend can parse them
      const { location, guest_info, ...scalar } = rest;
      Object.entries(scalar).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, String(v));
      });
      if (location) formData.append("location", JSON.stringify(location));
      if (guest_info) formData.append("guest_info", JSON.stringify(guest_info));

      imageFiles.forEach((file) => formData.append("images", file));

      const response = await apiClient.post<ServiceRequest>("/requests", formData);
      return response.data;
    }

    const response = await apiClient.post<ServiceRequest>("/requests", rest);
    return response.data;
  }

  async getRequests(
    filters?: RequestFilters,
  ): Promise<PaginatedResponse<ServiceRequest>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.category_id) params.append("category_id", filters.category_id);
    if (filters?.min_budget)
      params.append("min_budget", filters.min_budget.toString());
    if (filters?.max_budget)
      params.append("max_budget", filters.max_budget.toString());
    if (filters?.cursor) params.append("cursor", filters.cursor);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.search) params.append("search", filters.search);
    if (filters?.sort_by) params.append("sort_by", filters.sort_by);
    if (filters?.sort_order) params.append("sort_order", filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<ServiceRequest>>(
      `/requests?${params.toString()}`,
    );
    // API client unwraps to { data, total } for responses with total
    return response.data;
  }

  async getRequestById(id: string): Promise<ServiceRequest> {
    const response = await apiClient.get<ServiceRequest>(`/requests/${id}`);
    // API client unwraps to just the data
    return response.data;
  }

  async updateRequest(
    id: string,
    data: UpdateRequestData,
  ): Promise<ServiceRequest> {
    const response = await apiClient.patch<ServiceRequest>(
      `/requests/${id}`,
      data,
    );
    return response.data;
  }

  async cancelRequest(id: string): Promise<ServiceRequest> {
    const response = await apiClient.patch<ServiceRequest>(`/requests/${id}`, {
      status: "cancelled",
    });
    return response.data;
  }

  async getMyRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }): Promise<{ data: ServiceRequest[]; total: number; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.status) qs.append("status", params.status);
    if (params?.sort_by) qs.append("sort_by", params.sort_by);
    if (params?.sort_order) qs.append("sort_order", params.sort_order);
    const query = qs.toString();
    const response = await apiClient.get<any>(`/requests/my${query ? `?${query}` : ""}`);
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
    const list = apiClient.extractList<ServiceRequest>(envelope);
    return { data: list, total: list.length, page: 1, limit: list.length };
  }

  async getMyRequestsList(): Promise<ServiceRequest[]> {
    const result = await this.getMyRequests({ limit: 200 });
    return result.data;
  }

  async getCategories(): Promise<ServiceCategory[]> {
    const response = await apiClient.get<ServiceCategory[]>("/categories");
    return apiClient.extractList<ServiceCategory>(response.data);
  }
}

export const requestService = new RequestService();
