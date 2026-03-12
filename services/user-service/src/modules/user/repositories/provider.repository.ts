import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '@/common/database/database.module';
import { Provider } from '../entities/provider.entity';

@Injectable()
export class ProviderRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(
    userId: string,
    businessName: string,
    description?: string,
  ): Promise<Provider> {
    const query = `
      INSERT INTO providers (user_id, business_name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.pool.query(query, [userId, businessName, description]);
    return result.rows[0];
  }

  async findById(id: string): Promise<Provider | null> {
    const query = 'SELECT * FROM providers WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<Provider | null> {
    const query = 'SELECT * FROM providers WHERE user_id = $1';
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async update(
    id: string,
    businessName?: string,
    description?: string,
  ): Promise<Provider> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (businessName !== undefined) {
      updates.push(`business_name = $${paramCount++}`);
      values.push(businessName);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE providers
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findPaginated(
    limit: number,
    cursor?: string,
    categoryId?: string,
    search?: string,
    locationId?: string,
  ): Promise<Provider[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (cursor) {
      conditions.push(`providers.created_at < (SELECT created_at FROM providers WHERE id = $${paramCount})`);
      values.push(cursor);
      paramCount++;
    }

    if (categoryId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM provider_services 
        WHERE provider_services.provider_id = providers.id 
        AND provider_services.category_id = $${paramCount}
      )`);
      values.push(categoryId);
      paramCount++;
    }

    if (search) {
      conditions.push(`(
        providers.business_name ILIKE $${paramCount} 
        OR providers.description ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    values.push(limit);
    const query = `
      SELECT DISTINCT providers.*
      FROM providers
      ${whereClause}
      ORDER BY providers.created_at DESC
      LIMIT $${paramCount}
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM providers WHERE id = $1';
    await this.pool.query(query, [id]);
  }
}
