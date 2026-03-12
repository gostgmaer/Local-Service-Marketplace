import { apiClient } from './api-client';

export interface Job {
  id: string;
  requestId: string;
  proposalId: string;
  customerId: string;
  providerId: string;
  status:
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'disputed';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  request?: any;
  proposal?: any;
  provider?: any;
  customer?: any;
}

export interface CreateJobData {
  requestId: string;
  proposalId: string;
  scheduledAt?: string;
}

export interface UpdateJobStatusData {
  status: Job['status'];
  notes?: string;
}

class JobService {
  async createJob(data: CreateJobData): Promise<Job> {
    return apiClient.post<Job>('/jobs', data);
  }

  async getJobById(id: string): Promise<Job> {
    return apiClient.get<Job>(`/jobs/${id}`);
  }

  async updateJobStatus(
    id: string,
    data: UpdateJobStatusData,
  ): Promise<Job> {
    return apiClient.patch<Job>(`/jobs/${id}/status`, data);
  }

  async startJob(id: string): Promise<Job> {
    return apiClient.patch<Job>(`/jobs/${id}/status`, {
      status: 'in_progress',
    });
  }

  async completeJob(id: string): Promise<Job> {
    return apiClient.patch<Job>(`/jobs/${id}/status`, {
      status: 'completed',
    });
  }

  async cancelJob(id: string, reason?: string): Promise<Job> {
    return apiClient.patch<Job>(`/jobs/${id}/status`, {
      status: 'cancelled',
      notes: reason,
    });
  }

  async getMyJobs(): Promise<Job[]> {
    return apiClient.get<Job[]>('/jobs/my');
  }

  async getJobsByStatus(status: Job['status']): Promise<Job[]> {
    return apiClient.get<Job[]>(`/jobs?status=${status}`);
  }
}

export const jobService = new JobService();
