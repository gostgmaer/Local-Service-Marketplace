import { apiClient } from './api-client';

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  content: string;
  attachments?: Attachment[];
  createdAt: string;
  sender?: {
    id: string;
    name: string;
  };
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface SendMessageData {
  jobId: string;
  content: string;
  attachments?: File[];
}

class MessageService {
  async sendMessage(data: SendMessageData): Promise<Message> {
    const formData = new FormData();
    formData.append('jobId', data.jobId);
    formData.append('content', data.content);

    if (data.attachments) {
      data.attachments.forEach((file) => {
        formData.append('attachments', file);
      });
    }

    return apiClient.post<Message>('/messages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async getMessagesByJob(jobId: string): Promise<Message[]> {
    return apiClient.get<Message[]>(`/jobs/${jobId}/messages`);
  }

  async getConversations(): Promise<any[]> {
    return apiClient.get<any[]>('/messages/conversations');
  }

  async markAsRead(messageId: string): Promise<void> {
    return apiClient.patch<void>(`/messages/${messageId}/read`, {});
  }
}

export const messageService = new MessageService();
