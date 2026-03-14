import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Subscription } from '../entities/subscription.entity';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async create(data: {
    provider_id: string;
    plan_id: string;
    status?: 'active' | 'cancelled' | 'expired' | 'pending';
    started_at?: Date;
    expires_at?: Date;
  }): Promise<Subscription> {
    const query = `
      INSERT INTO subscriptions (
        provider_id, plan_id, status, started_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.provider_id,
      data.plan_id,
      data.status || 'pending',
      data.started_at || new Date(),
      data.expires_at || null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findById(id: string): Promise<Subscription | null> {
    const query = `SELECT * FROM subscriptions WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByProvider(providerId: string): Promise<Subscription[]> {
    const query = `
      SELECT s.*, p.name as plan_name, p.price, p.billing_period
      FROM subscriptions s
      JOIN pricing_plans p ON s.plan_id = p.id
      WHERE s.provider_id = $1
      ORDER BY s.created_at DESC
    `;
    const result = await this.pool.query(query, [providerId]);
    return result.rows;
  }

  async findActiveByProvider(providerId: string): Promise<Subscription | null> {
    const query = `
      SELECT s.*, p.name as plan_name, p.price, p.billing_period
      FROM subscriptions s
      JOIN pricing_plans p ON s.plan_id = p.id
      WHERE s.provider_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [providerId]);
    return result.rows[0] || null;
  }

  async updateStatus(
    id: string,
    status: 'active' | 'cancelled' | 'expired' | 'pending'
  ): Promise<Subscription> {
    const query = `
      UPDATE subscriptions
      SET status = $1,
          cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.pool.query(query, [status, id]);
    return result.rows[0];
  }

  async cancel(id: string): Promise<Subscription> {
    const query = `
      UPDATE subscriptions
      SET status = 'cancelled',
          cancelled_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  async getExpiringSubscriptions(days: number = 7): Promise<Subscription[]> {
    const query = `
      SELECT s.*, p.business_name, p.user_id, pl.name as plan_name
      FROM subscriptions s
      JOIN providers p ON s.provider_id = p.id
      JOIN pricing_plans pl ON s.plan_id = pl.id
      WHERE s.status = 'active'
        AND s.expires_at IS NOT NULL
        AND s.expires_at > NOW()
        AND s.expires_at <= NOW() + INTERVAL '1 day' * $1
      ORDER BY s.expires_at ASC
    `;
    const result = await this.pool.query(query, [days]);
    return result.rows;
  }

  async expireOldSubscriptions(): Promise<number> {
    const query = `
      UPDATE subscriptions
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    `;
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }
}
