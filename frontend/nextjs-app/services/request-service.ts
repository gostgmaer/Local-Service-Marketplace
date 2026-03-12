import { apiClient } from './api-client';

export interface ServiceRequest {
  id: string;
  customerId: string;
  categoryId: string;
  title: string;
  description: string;
  budget: number;
  locationId?: string;
  status: 'open' | 'assigned' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface CreateRequestData {
  categoryId: string;
  title: string;
  description: string;
  budget: number;
  locationId?: string;
}

export interface UpdateRequestData {
  title?: string;
  description?: string;
  budget?: number;
  status?: ServiceRequest['status'];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RequestFilters {
  status?: string;
  categoryId?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}

class RequestService {
  async createRequest(data: CreateRequestData): Promise<ServiceRequest> {
    return apiClient.post<ServiceRequest>('/requests', data);
  }

  async getRequests(
    filters?: RequestFilters,
  ): Promise<PaginatedResponse<ServiceRequest>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.minBudget)
      params.append('minBudget', filters.minBudget.toString());
    if (filters?.maxBudget)
      params.append('maxBudget', filters.maxBudget.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return apiClient.get<PaginatedResponse<ServiceRequest>>(
      `/requests?${params.toString()}`,
    );
  }

  async getRequestById(id: string): Promise<ServiceRequest> {
    return apiClient.get<ServiceRequest>(`/requests/${id}`);
  }

  async updateRequest(
    id: string,
    data: UpdateRequestData,
  ): Promise<ServiceRequest> {
    return apiClient.patch<ServiceRequest>(`/requests/${id}`, data);
  }

  async cancelRequest(id: string): Promise<ServiceRequest> {
    return apiClient.patch<ServiceRequest>(`/requests/${id}`, {
      status: 'cancelled',
    });
  }

  async getMyRequests(): Promise<ServiceRequest[]> {
    return apiClient.get<ServiceRequest[]>('/requests/my');
  }

  async getCategories(): Promise<any[]> {
    return apiClient.get<any[]>('/requests/categories');
  }
}

export const requestService = new RequestService();
