import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DailyMetric } from '../entities/daily-metric.entity';

@Injectable()
export class MetricsRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async getDailyMetrics(
    startDate?: string,
    endDate?: string,
    limit: number = 30,
  ): Promise<DailyMetric[]> {
    let query = `
      SELECT date, total_users as "totalUsers", total_requests as "totalRequests", 
             total_jobs as "totalJobs", total_payments as "totalPayments"
      FROM daily_metrics
    `;

    const values: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`date >= $${values.length + 1}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`date <= $${values.length + 1}`);
      values.push(endDate);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY date DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getMetricByDate(date: string): Promise<DailyMetric | null> {
    const query = `
      SELECT date, total_users as "totalUsers", total_requests as "totalRequests", 
             total_jobs as "totalJobs", total_payments as "totalPayments"
      FROM daily_metrics
      WHERE date = $1
    `;

    const result = await this.pool.query(query, [date]);
    return result.rows[0] || null;
  }

  async upsertDailyMetric(
    date: string,
    totalUsers: number,
    totalRequests: number,
    totalJobs: number,
    totalPayments: number,
  ): Promise<DailyMetric> {
    const query = `
      INSERT INTO daily_metrics (date, total_users, total_requests, total_jobs, total_payments)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (date) 
      DO UPDATE SET 
        total_users = EXCLUDED.total_users,
        total_requests = EXCLUDED.total_requests,
        total_jobs = EXCLUDED.total_jobs,
        total_payments = EXCLUDED.total_payments
      RETURNING date, total_users as "totalUsers", total_requests as "totalRequests", 
                total_jobs as "totalJobs", total_payments as "totalPayments"
    `;

    const values = [date, totalUsers, totalRequests, totalJobs, totalPayments];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async aggregateDailyMetrics(date: string): Promise<DailyMetric> {
    // Get counts from various tables for the specified date
    const usersQuery = `SELECT COUNT(DISTINCT id) as count FROM users WHERE DATE(created_at) <= $1`;
    const requestsQuery = `SELECT COUNT(*) as count FROM service_requests WHERE DATE(created_at) = $1`;
    const jobsQuery = `SELECT COUNT(*) as count FROM jobs WHERE DATE(created_at) = $1`;
    const paymentsQuery = `SELECT COUNT(*) as count FROM payments WHERE DATE(created_at) = $1`;

    const [usersResult, requestsResult, jobsResult, paymentsResult] =
      await Promise.all([
        this.pool.query(usersQuery, [date]),
        this.pool.query(requestsQuery, [date]),
        this.pool.query(jobsQuery, [date]),
        this.pool.query(paymentsQuery, [date]),
      ]);

    const totalUsers = parseInt(usersResult.rows[0].count) || 0;
    const totalRequests = parseInt(requestsResult.rows[0].count) || 0;
    const totalJobs = parseInt(jobsResult.rows[0].count) || 0;
    const totalPayments = parseInt(paymentsResult.rows[0].count) || 0;

    return this.upsertDailyMetric(
      date,
      totalUsers,
      totalRequests,
      totalJobs,
      totalPayments,
    );
  }

  async getMetricsCount(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM daily_metrics`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count) || 0;
  }
}
