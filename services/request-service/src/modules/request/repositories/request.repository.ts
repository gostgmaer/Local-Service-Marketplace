import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { ServiceRequest } from '../entities/service-request.entity';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import { RequestQueryDto } from '../dto/request-query.dto';

@Injectable()
export class RequestRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createRequest(dto: CreateRequestDto): Promise<ServiceRequest> {
    const query = `
      INSERT INTO service_requests (user_id, category_id, location_id, description, budget, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, user_id, category_id, location_id, description, budget, status, created_at
    `;

    const values = [
      dto.user_id,
      dto.category_id,
      dto.location_id || null,
      dto.description,
      dto.budget,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getRequestsPaginated(queryDto: RequestQueryDto): Promise<ServiceRequest[]> {
    const { user_id, category_id, status, limit = 20, cursor } = queryDto;

    let query = `
      SELECT id, user_id, category_id, location_id, description, budget, status, created_at
      FROM service_requests
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND user_id = $${paramIndex++}`;
      values.push(user_id);
    }

    if (category_id) {
      query += ` AND category_id = $${paramIndex++}`;
      values.push(category_id);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (cursor) {
      query += ` AND created_at < (SELECT created_at FROM service_requests WHERE id = $${paramIndex++})`;
      values.push(cursor);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    values.push(limit + 1);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getRequestById(id: string): Promise<ServiceRequest | null> {
    const query = `
      SELECT id, user_id, category_id, location_id, description, budget, status, created_at
      FROM service_requests
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateRequest(id: string, dto: UpdateRequestDto): Promise<ServiceRequest | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(dto.category_id);
    }

    if (dto.location_id !== undefined) {
      updates.push(`location_id = $${paramIndex++}`);
      values.push(dto.location_id);
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }

    if (dto.budget !== undefined) {
      updates.push(`budget = $${paramIndex++}`);
      values.push(dto.budget);
    }

    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }

    if (updates.length === 0) {
      return this.getRequestById(id);
    }

    const query = `
      UPDATE service_requests
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++}
      RETURNING id, user_id, category_id, location_id, description, budget, status, created_at
    `;

    values.push(id);

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async deleteRequest(id: string): Promise<boolean> {
    const query = `DELETE FROM service_requests WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async getRequestsByUser(userId: string): Promise<ServiceRequest[]> {
    const query = `
      SELECT id, user_id, category_id, location_id, description, budget, status, created_at
      FROM service_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }
}
