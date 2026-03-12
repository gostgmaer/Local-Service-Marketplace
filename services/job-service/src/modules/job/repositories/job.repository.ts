import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Job } from '../entities/job.entity';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobStatus } from '../dto/update-job-status.dto';

@Injectable()
export class JobRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createJob(dto: CreateJobDto): Promise<Job> {
    const query = `
      INSERT INTO jobs (request_id, provider_id, status, started_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING id, request_id, provider_id, status, started_at, completed_at
    `;

    const values = [dto.request_id, dto.provider_id];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getJobById(id: string): Promise<Job | null> {
    const query = `
      SELECT id, request_id, provider_id, status, started_at, completed_at
      FROM jobs
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
    const query = `
      UPDATE jobs
      SET status = $1
      WHERE id = $2
      RETURNING id, request_id, provider_id, status, started_at, completed_at
    `;

    const result = await this.pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  async completeJob(id: string): Promise<Job | null> {
    const query = `
      UPDATE jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
      RETURNING id, request_id, provider_id, status, started_at, completed_at
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getJobByRequestId(requestId: string): Promise<Job | null> {
    const query = `
      SELECT id, request_id, provider_id, status, started_at, completed_at
      FROM jobs
      WHERE request_id = $1
    `;

    const result = await this.pool.query(query, [requestId]);
    return result.rows[0] || null;
  }

  async getJobsByProvider(providerId: string): Promise<Job[]> {
    const query = `
      SELECT id, request_id, provider_id, status, started_at, completed_at
      FROM jobs
      WHERE provider_id = $1
      ORDER BY started_at DESC
    `;

    const result = await this.pool.query(query, [providerId]);
    return result.rows;
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    const query = `
      SELECT id, request_id, provider_id, status, started_at, completed_at
      FROM jobs
      WHERE status = $1
      ORDER BY started_at DESC
    `;

    const result = await this.pool.query(query, [status]);
    return result.rows;
  }
}
