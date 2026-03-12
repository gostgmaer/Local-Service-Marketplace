import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Coupon } from '../entities/coupon.entity';
import { CouponUsage } from '../entities/coupon-usage.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CouponRepository {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const query = 'SELECT * FROM coupons WHERE code = $1';
    const result = await this.pool.query(query, [code]);
    if (result.rows.length === 0) {
      return null;
    }
    return new Coupon({
      id: result.rows[0].id,
      code: result.rows[0].code,
      discountPercent: parseFloat(result.rows[0].discount_percent),
      expiresAt: result.rows[0].expires_at,
    });
  }

  async isCouponUsedByUser(couponId: string, userId: string): Promise<boolean> {
    const query = 'SELECT COUNT(*) FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2';
    const result = await this.pool.query(query, [couponId, userId]);
    return parseInt(result.rows[0].count) > 0;
  }

  async recordCouponUsage(couponId: string, userId: string): Promise<CouponUsage> {
    const id = uuidv4();
    const query = `
      INSERT INTO coupon_usage (id, coupon_id, user_id, used_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const values = [id, couponId, userId];
    const result = await this.pool.query(query, values);
    return new CouponUsage({
      id: result.rows[0].id,
      couponId: result.rows[0].coupon_id,
      userId: result.rows[0].user_id,
      usedAt: result.rows[0].used_at,
    });
  }

  async getCouponUsagesByUser(userId: string): Promise<CouponUsage[]> {
    const query = 'SELECT * FROM coupon_usage WHERE user_id = $1 ORDER BY used_at DESC';
    const result = await this.pool.query(query, [userId]);
    return result.rows.map(
      (row) =>
        new CouponUsage({
          id: row.id,
          couponId: row.coupon_id,
          userId: row.user_id,
          usedAt: row.used_at,
        }),
    );
  }
}
