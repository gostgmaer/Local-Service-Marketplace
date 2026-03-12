import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '@/common/database/database.module';
import { LoginAttempt } from '../entities/login-attempt.entity';

@Injectable()
export class LoginAttemptRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(email: string, success: boolean, ipAddress?: string): Promise<LoginAttempt> {
    const query = `
      INSERT INTO login_attempts (email, success, ip_address)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.pool.query(query, [email, success, ipAddress]);
    return result.rows[0];
  }

  async countRecentFailedAttempts(email: string, windowMinutes: number = 15): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE email = $1 
        AND success = false 
        AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'
    `;
    const result = await this.pool.query(query, [email]);
    return parseInt(result.rows[0].count, 10);
  }

  async deleteOldAttempts(daysOld: number = 30): Promise<void> {
    const query = `
      DELETE FROM login_attempts 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `;
    await this.pool.query(query);
  }
}
