import { apiClient } from "./api-client";

export interface Message {
  id: string;
  display_id?: string;
  job_id: string;
  sender_id: string;
  message: string;
  attachments?: Attachment[];
  created_at: string;
  sender?: {
    id: string;
    name: string;
  };
  read?: boolean;
  read_at?: string;
  edited?: boolean;
  edited_at?: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  /** File service ID — resolve via GET /api/v1/files/:file_id with JWT to get the URL. */
  file_id: string;
  /** @deprecated Legacy records only. Do not use for display — use file_id instead. */
  file_url?: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface Conversation {
  job_id: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  participant?: { id: string; name?: string };
}

export interface SendMessageData {
  job_id: string;
  message: string;
}

class MessageService {
  async sendMessage(data: SendMessageData): Promise<Message> {
    const response = await apiClient.post<Message>("/messages", {
      job_id: data.job_id,
      message: data.message,
    });
    return response.data;
  }

  async getMessagesByJob(jobId: string): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(`/messages/jobs/${jobId}`);
    return apiClient.extractList<Message>(response.data);
  }

  async getConversations(params?: { page?: number; limit?: number }): Promise<{ data: Conversation[]; total: number; page: number; limit: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    const qs = queryParams.toString();
    const response = await apiClient.get<any>(
      `/messages/conversations${qs ? `?${qs}` : ""}`,
    );
    const payload = response.data;
    const list = apiClient.extractList<Conversation>(payload);
    return {
      data: list,
      total: payload?.total ?? list.length,
      page: payload?.page ?? params?.page ?? 1,
      limit: payload?.limit ?? params?.limit ?? 20,
    };
  }

  async markAsRead(messageId: string): Promise<void> {
    const response = await apiClient.patch<void>(
      `/messages/${messageId}/read`,
      {},
    );
    return response.data;
  }
}

export const messageService = new MessageService();
