import { apiClient } from "./api-client";

export interface Notification {
  id: string;
  display_id?: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  unsubscribed?: boolean;
  created_at: string;
}

export interface NotificationFilters {
  read?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NotificationPage {
  data: Notification[];
  total: number;
  hasMore: boolean;
}

class NotificationService {
  async getNotifications(
    filters?: NotificationFilters,
  ): Promise<NotificationPage> {
    const params = new URLSearchParams();
    if (filters?.read !== undefined)
      params.append("read", filters.read.toString());
    if (filters?.type) params.append("type", filters.type);
    if (filters?.page && filters.page > 1)
      params.append("cursor", String((filters.page - 1) * (filters?.limit ?? 20)));
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await apiClient.get<any>(
      `/notifications?${params.toString()}`,
    );
    const payload: any = response.data;

    let list: Notification[] = [];
    let total = 0;

    if (Array.isArray(payload)) {
      list = payload as Notification[];
      total = list.length;
    } else if (payload?.notifications && Array.isArray(payload.notifications)) {
      list = payload.notifications as Notification[];
      total = payload.total ?? payload.unreadCount ?? list.length;
    } else if (payload?.data?.notifications && Array.isArray(payload.data.notifications)) {
      list = payload.data.notifications as Notification[];
      total = payload.data.total ?? list.length;
    } else if (payload?.data && Array.isArray(payload.data)) {
      list = payload.data as Notification[];
      total = payload.total ?? list.length;
    }

    const limit = filters?.limit ?? 20;
    const hasMore = list.length >= limit;

    return { data: list, total, hasMore };
  }

  async markAsRead(id: string): Promise<void> {
    const response = await apiClient.patch<void>(
      `/notifications/${id}/read`,
      {},
    );
    return response.data;
  }

  async markAllAsRead(): Promise<void> {
    const response = await apiClient.patch<void>("/notifications/read-all", {});
    return response.data;
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await apiClient.get<{ count: number }>(
      "/notifications/unread-count",
    );
    return response.data;
  }

  async deleteNotification(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/notifications/${id}`);
    return response.data;
  }

  // ------------------ Notification Preferences ------------------

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get<NotificationPreferences>(
      "/notification-preferences",
    );
    return response.data;
  }

  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const response = await apiClient.put<NotificationPreferences>(
      "/notification-preferences",
      preferences,
    );
    return response.data;
  }

  async enableAllNotifications(): Promise<NotificationPreferences> {
    const response = await apiClient.put<NotificationPreferences>(
      "/notification-preferences/enable-all",
    );
    return response.data;
  }

  async disableAllNotifications(): Promise<NotificationPreferences> {
    const response = await apiClient.put<NotificationPreferences>(
      "/notification-preferences/disable-all",
    );
    return response.data;
  }

  // ------------------ Unsubscribe ------------------

  async unsubscribe(
    email: string,
    reason?: string,
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/notifications/unsubscribe",
      { email, reason },
    );
    return response.data;
  }
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  new_request_alerts: boolean;
  proposal_alerts: boolean;
  job_updates: boolean;
  payment_alerts: boolean;
  review_alerts: boolean;
  message_alerts: boolean;
  created_at: string;
  updated_at?: string;
}

export const notificationService = new NotificationService();
