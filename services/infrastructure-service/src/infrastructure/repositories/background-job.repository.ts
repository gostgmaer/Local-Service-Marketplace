import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { BackgroundJob } from '../entities/background-job.entity';
import { CreateBackgroundJobDto } from '../dto/create-background-job.dto';

@Injectable()
export class BackgroundJobRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createJob(createJobDto: CreateBackgroundJobDto): Promise<BackgroundJob> {
    const query = `
      INSERT INTO background_jobs (job_type, payload, status, attempts)
      VALUES ($1, $2, 'pending', 0)
      RETURNING id, job_type as "jobType", payload, status, attempts
    `;

    const values = [
      createJobDto.jobType,
      createJobDto.payload || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getJobById(id: string): Promise<BackgroundJob | null> {
    const query = `
      SELECT id, job_type as "jobType", payload, status, attempts
      FROM background_jobs
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getAllJobs(
    limit: number = 100,
    offset: number = 0,
  ): Promise<BackgroundJob[]> {
    const query = `
      SELECT id, job_type as "jobType", payload, status, attempts
      FROM background_jobs
      ORDER BY attempts ASC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  async getJobsByStatus(status: string): Promise<BackgroundJob[]> {
    const query = `
      SELECT id, job_type as "jobType", payload, status, attempts
      FROM background_jobs
      WHERE status = $1
      ORDER BY attempts ASC
    `;

    const result = await this.pool.query(query, [status]);
    return result.rows;
  }

  async updateJobStatus(
    id: string,
    status: string,
  ): Promise<BackgroundJob | null> {
    const query = `
      UPDATE background_jobs
      SET status = $1
      WHERE id = $2
      RETURNING id, job_type as "jobType", payload, status, attempts
    `;

    const result = await this.pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  async incrementJobAttempts(id: string): Promise<BackgroundJob | null> {
    const query = `
      UPDATE background_jobs
      SET attempts = attempts + 1
      WHERE id = $1
      RETURNING id, job_type as "jobType", payload, status, attempts
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async deleteJob(id: string): Promise<void> {
    const query = `DELETE FROM background_jobs WHERE id = $1`;
    await this.pool.query(query, [id]);
  }

  async getJobsCount(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM background_jobs`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count) || 0;
  }
}
