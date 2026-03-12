import { apiClient } from './api-client';

export interface Payment {
  id: string;
  jobId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentData {
  jobId: string;
  amount: number;
  paymentMethod: string;
}

export interface RefundData {
  reason: string;
  amount?: number;
}

class PaymentService {
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    return apiClient.post<Payment>('/payments', data);
  }

  async getPaymentById(id: string): Promise<Payment> {
    return apiClient.get<Payment>(`/payments/${id}`);
  }

  async getPaymentsByJob(jobId: string): Promise<Payment[]> {
    return apiClient.get<Payment[]>(`/jobs/${jobId}/payments`);
  }

  async requestRefund(paymentId: string, data: RefundData): Promise<Payment> {
    return apiClient.post<Payment>(`/payments/${paymentId}/refund`, data);
  }

  async getMyPayments(): Promise<Payment[]> {
    return apiClient.get<Payment[]>('/payments/my');
  }

  async getPaymentStatus(id: string): Promise<Payment> {
    return apiClient.get<Payment>(`/payments/${id}/status`);
  }
}

export const paymentService = new PaymentService();
