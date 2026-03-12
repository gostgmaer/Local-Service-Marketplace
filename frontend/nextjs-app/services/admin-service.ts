import { apiClient } from './api-client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}

export interface Dispute {
  id: string;
  jobId: string;
  reporterId: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
}

class AdminService {
  async getUsers(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<User[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);

    return apiClient.get<User[]>(`/admin/users?${searchParams.toString()}`);
  }

  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`/admin/users/${id}`);
  }

  async suspendUser(id: string, reason: string): Promise<User> {
    return apiClient.patch<User>(`/admin/users/${id}/suspend`, { reason });
  }

  async activateUser(id: string): Promise<User> {
    return apiClient.patch<User>(`/admin/users/${id}/activate`, {});
  }

  async getDisputes(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Dispute[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    return apiClient.get<Dispute[]>(
      `/admin/disputes?${searchParams.toString()}`,
    );
  }

  async updateDispute(
    id: string,
    data: { status: string; resolution?: string },
  ): Promise<Dispute> {
    return apiClient.patch<Dispute>(`/admin/disputes/${id}`, data);
  }

  async getAuditLogs(params?: {
    userId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    return apiClient.get<AuditLog[]>(
      `/admin/audit-logs?${searchParams.toString()}`,
    );
  }

  async getSystemStats(): Promise<any> {
    return apiClient.get<any>('/admin/stats');
  }
}

export const adminService = new AdminService();
