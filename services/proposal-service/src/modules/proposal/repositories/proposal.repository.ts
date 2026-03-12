import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Proposal } from '../entities/proposal.entity';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { ProposalQueryDto } from '../dto/proposal-query.dto';

@Injectable()
export class ProposalRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createProposal(dto: CreateProposalDto): Promise<Proposal> {
    const query = `
      INSERT INTO proposals (request_id, provider_id, price, message, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, request_id, provider_id, price, message, status, created_at
    `;

    const values = [dto.request_id, dto.provider_id, dto.price, dto.message];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getProposalsForRequest(requestId: string, limit = 20): Promise<Proposal[]> {
    const query = `
      SELECT id, request_id, provider_id, price, message, status, created_at
      FROM proposals
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [requestId, limit + 1]);
    return result.rows;
  }

  async getProposalById(id: string): Promise<Proposal | null> {
    const query = `
      SELECT id, request_id, provider_id, price, message, status, created_at
      FROM proposals
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async acceptProposal(id: string): Promise<Proposal | null> {
    const query = `
      UPDATE proposals
      SET status = 'accepted'
      WHERE id = $1
      RETURNING id, request_id, provider_id, price, message, status, created_at
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async rejectProposal(id: string): Promise<Proposal | null> {
    const query = `
      UPDATE proposals
      SET status = 'rejected'
      WHERE id = $1
      RETURNING id, request_id, provider_id, price, message, status, created_at
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getProposalsByProvider(providerId: string): Promise<Proposal[]> {
    const query = `
      SELECT id, request_id, provider_id, price, message, status, created_at
      FROM proposals
      WHERE provider_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [providerId]);
    return result.rows;
  }

  async getProposalsPaginated(queryDto: ProposalQueryDto): Promise<Proposal[]> {
    const { request_id, provider_id, status, limit = 20, cursor } = queryDto;

    let query = `
      SELECT id, request_id, provider_id, price, message, status, created_at
      FROM proposals
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (request_id) {
      query += ` AND request_id = $${paramIndex++}`;
      values.push(request_id);
    }

    if (provider_id) {
      query += ` AND provider_id = $${paramIndex++}`;
      values.push(provider_id);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (cursor) {
      query += ` AND created_at < (SELECT created_at FROM proposals WHERE id = $${paramIndex++})`;
      values.push(cursor);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    values.push(limit + 1);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async hasExistingProposal(requestId: string, providerId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM proposals
      WHERE request_id = $1 AND provider_id = $2
    `;

    const result = await this.pool.query(query, [requestId, providerId]);
    return result.rows.length > 0;
  }
}
