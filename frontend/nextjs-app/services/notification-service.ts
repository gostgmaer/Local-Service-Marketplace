import { apiClient } from './api-client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export interface NotificationFilters {
  read?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

class NotificationService {
  async getNotifications(
    filters?: NotificationFilters,
  ): Promise<Notification[]> {
    const params = new URLSearchParams();
    if (filters?.read !== undefined)
      params.append('read', filters.read.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return apiClient.get<Notification[]>(
      `/notifications?${params.toString()}`,
    );
  }

  async markAsRead(id: string): Promise<void> {
    return apiClient.patch<void>(`/notifications/${id}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    return apiClient.patch<void>('/notifications/read-all', {});
  }

  async getUnreadCount(): Promise<number> {
    const data = await apiClient.get<{ count: number }>(
      '/notifications/unread-count',
    );
    return data.count;
  }

  async deleteNotification(id: string): Promise<void> {
    return apiClient.delete<void>(`/notifications/${id}`);
  }
}

export const notificationService = new NotificationService();
