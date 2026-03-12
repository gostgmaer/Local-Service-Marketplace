import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { RateLimit } from '../entities/rate-limit.entity';

@Injectable()
export class RateLimitRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async getRateLimit(key: string): Promise<RateLimit | null> {
    const query = `
      SELECT id, key, request_count as "requestCount", window_start as "windowStart"
      FROM rate_limits
      WHERE key = $1
    `;

    const result = await this.pool.query(query, [key]);
    return result.rows[0] || null;
  }

  async createRateLimit(
    key: string,
    requestCount: number,
    windowStart: Date,
  ): Promise<RateLimit> {
    const query = `
      INSERT INTO rate_limits (key, request_count, window_start)
      VALUES ($1, $2, $3)
      RETURNING id, key, request_count as "requestCount", window_start as "windowStart"
    `;

    const result = await this.pool.query(query, [key, requestCount, windowStart]);
    return result.rows[0];
  }

  async updateRateLimit(
    key: string,
    requestCount: number,
    windowStart: Date,
  ): Promise<RateLimit | null> {
    const query = `
      UPDATE rate_limits
      SET request_count = $2, window_start = $3
      WHERE key = $1
      RETURNING id, key, request_count as "requestCount", window_start as "windowStart"
    `;

    const result = await this.pool.query(query, [key, requestCount, windowStart]);
    return result.rows[0] || null;
  }

  async incrementRequestCount(key: string): Promise<RateLimit | null> {
    const query = `
      UPDATE rate_limits
      SET request_count = request_count + 1
      WHERE key = $1
      RETURNING id, key, request_count as "requestCount", window_start as "windowStart"
    `;

    const result = await this.pool.query(query, [key]);
    return result.rows[0] || null;
  }

  async deleteRateLimit(key: string): Promise<void> {
    const query = `DELETE FROM rate_limits WHERE key = $1`;
    await this.pool.query(query, [key]);
  }

  async deleteExpiredRateLimits(expiryTime: Date): Promise<void> {
    const query = `DELETE FROM rate_limits WHERE window_start < $1`;
    await this.pool.query(query, [expiryTime]);
  }
}
