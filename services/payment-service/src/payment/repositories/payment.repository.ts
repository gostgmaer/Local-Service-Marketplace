import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Payment } from '../entities/payment.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentRepository {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async createPayment(
    jobId: string,
    amount: number,
    currency: string,
    transactionId?: string,
  ): Promise<Payment> {
    const id = uuidv4();
    const query = `
      INSERT INTO payments (id, job_id, amount, currency, status, transaction_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    const values = [id, jobId, amount, currency, 'pending', transactionId];
    const result = await this.pool.query(query, values);
    return new Payment({
      id: result.rows[0].id,
      jobId: result.rows[0].job_id,
      amount: parseFloat(result.rows[0].amount),
      currency: result.rows[0].currency,
      status: result.rows[0].status,
      transactionId: result.rows[0].transaction_id,
      createdAt: result.rows[0].created_at,
    });
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return new Payment({
      id: result.rows[0].id,
      jobId: result.rows[0].job_id,
      amount: parseFloat(result.rows[0].amount),
      currency: result.rows[0].currency,
      status: result.rows[0].status,
      transactionId: result.rows[0].transaction_id,
      createdAt: result.rows[0].created_at,
    });
  }

  async updatePaymentStatus(
    id: string,
    status: 'pending' | 'completed' | 'failed' | 'refunded',
    transactionId?: string,
  ): Promise<Payment> {
    const query = `
      UPDATE payments 
      SET status = $1, transaction_id = COALESCE($2, transaction_id)
      WHERE id = $3
      RETURNING *
    `;
    const result = await this.pool.query(query, [status, transactionId, id]);
    return new Payment({
      id: result.rows[0].id,
      jobId: result.rows[0].job_id,
      amount: parseFloat(result.rows[0].amount),
      currency: result.rows[0].currency,
      status: result.rows[0].status,
      transactionId: result.rows[0].transaction_id,
      createdAt: result.rows[0].created_at,
    });
  }

  async getPaymentsByJobId(jobId: string): Promise<Payment[]> {
    const query = 'SELECT * FROM payments WHERE job_id = $1 ORDER BY created_at DESC';
    const result = await this.pool.query(query, [jobId]);
    return result.rows.map(
      (row) =>
        new Payment({
          id: row.id,
          jobId: row.job_id,
          amount: parseFloat(row.amount),
          currency: row.currency,
          status: row.status,
          transactionId: row.transaction_id,
          createdAt: row.created_at,
        }),
    );
  }
}
