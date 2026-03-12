import { apiClient } from './api-client';

export interface Proposal {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  estimatedDuration: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
  updatedAt: string;
  provider?: {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
  };
}

export interface CreateProposalData {
  requestId: string;
  price: number;
  estimatedDuration: string;
  description: string;
}

export interface UpdateProposalData {
  price?: number;
  estimatedDuration?: string;
  description?: string;
}

class ProposalService {
  async createProposal(data: CreateProposalData): Promise<Proposal> {
    return apiClient.post<Proposal>('/proposals', data);
  }

  async getProposalsByRequest(requestId: string): Promise<Proposal[]> {
    return apiClient.get<Proposal[]>(`/requests/${requestId}/proposals`);
  }

  async getProposalById(id: string): Promise<Proposal> {
    return apiClient.get<Proposal>(`/proposals/${id}`);
  }

  async updateProposal(
    id: string,
    data: UpdateProposalData,
  ): Promise<Proposal> {
    return apiClient.patch<Proposal>(`/proposals/${id}`, data);
  }

  async acceptProposal(id: string): Promise<Proposal> {
    return apiClient.post<Proposal>(`/proposals/${id}/accept`, {});
  }

  async rejectProposal(id: string): Promise<Proposal> {
    return apiClient.post<Proposal>(`/proposals/${id}/reject`, {});
  }

  async withdrawProposal(id: string): Promise<Proposal> {
    return apiClient.patch<Proposal>(`/proposals/${id}`, {
      status: 'withdrawn',
    });
  }

  async getMyProposals(): Promise<Proposal[]> {
    return apiClient.get<Proposal[]>('/proposals/my');
  }
}

export const proposalService = new ProposalService();
