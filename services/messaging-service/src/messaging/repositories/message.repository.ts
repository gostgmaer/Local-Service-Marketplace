import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Message } from '../entities/message.entity';
import { v4 as uuidv4 } from 'uuid';

export interface PaginatedMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class MessageRepository {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async createMessage(jobId: string, senderId: string, message: string): Promise<Message> {
    const id = uuidv4();
    const query = `
      INSERT INTO messages (id, job_id, sender_id, message, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    const values = [id, jobId, senderId, message];
    const result = await this.pool.query(query, values);
    return new Message({
      id: result.rows[0].id,
      jobId: result.rows[0].job_id,
      senderId: result.rows[0].sender_id,
      message: result.rows[0].message,
      createdAt: result.rows[0].created_at,
    });
  }

  async getMessageById(id: string): Promise<Message | null> {
    const query = 'SELECT * FROM messages WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return new Message({
      id: result.rows[0].id,
      jobId: result.rows[0].job_id,
      senderId: result.rows[0].sender_id,
      message: result.rows[0].message,
      createdAt: result.rows[0].created_at,
    });
  }

  async getMessagesForJob(
    jobId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedMessages> {
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM messages WHERE job_id = $1';
    const countResult = await this.pool.query(countQuery, [jobId]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated messages
    const query = `
      SELECT * FROM messages 
      WHERE job_id = $1 
      ORDER BY created_at ASC 
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [jobId, limit, offset]);

    const messages = result.rows.map(
      (row) =>
        new Message({
          id: row.id,
          jobId: row.job_id,
          senderId: row.sender_id,
          message: row.message,
          createdAt: row.created_at,
        }),
    );

    return {
      data: messages,
      total,
      page,
      limit,
      hasMore: offset + messages.length < total,
    };
  }

  async deleteMessage(id: string): Promise<void> {
    const query = 'DELETE FROM messages WHERE id = $1';
    await this.pool.query(query, [id]);
  }
}
