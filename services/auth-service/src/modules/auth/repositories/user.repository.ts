import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '@/common/database/database.module';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(email: string, passwordHash: string, role: string = 'customer'): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, role, email_verified, status)
      VALUES ($1, $2, $3, false, 'active')
      RETURNING *
    `;
    const result = await this.pool.query(query, [email, passwordHash, role]);
    return result.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW() 
      WHERE id = $2
    `;
    await this.pool.query(query, [passwordHash, userId]);
  }

  async verifyEmail(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET email_verified = true, updated_at = NOW() 
      WHERE id = $1
    `;
    await this.pool.query(query, [userId]);
  }

  async updateStatus(userId: string, status: string): Promise<void> {
    const query = `
      UPDATE users 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2
    `;
    await this.pool.query(query, [status, userId]);
  }
}
