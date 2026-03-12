import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Review } from '../entities/review.entity';
import { CreateReviewDto } from '../dto/create-review.dto';

@Injectable()
export class ReviewRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async createReview(createReviewDto: CreateReviewDto): Promise<Review> {
    const query = `
      INSERT INTO reviews (job_id, user_id, provider_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, job_id as "jobId", user_id as "userId", provider_id as "providerId", rating, comment, created_at as "createdAt"
    `;

    const values = [
      createReviewDto.jobId,
      createReviewDto.userId,
      createReviewDto.providerId,
      createReviewDto.rating,
      createReviewDto.comment,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getReviewById(id: string): Promise<Review | null> {
    const query = `
      SELECT id, job_id as "jobId", user_id as "userId", provider_id as "providerId", rating, comment, created_at as "createdAt"
      FROM reviews
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getProviderReviews(
    providerId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Review[]> {
    const query = `
      SELECT id, job_id as "jobId", user_id as "userId", provider_id as "providerId", rating, comment, created_at as "createdAt"
      FROM reviews
      WHERE provider_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [providerId, limit, offset]);
    return result.rows;
  }

  async getProviderRating(providerId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const query = `
      SELECT 
        COALESCE(AVG(rating), 0) as "averageRating",
        COUNT(*) as "totalReviews"
      FROM reviews
      WHERE provider_id = $1
    `;

    const result = await this.pool.query(query, [providerId]);
    return {
      averageRating: parseFloat(result.rows[0].averageRating) || 0,
      totalReviews: parseInt(result.rows[0].totalReviews) || 0,
    };
  }

  async getReviewCount(providerId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM reviews
      WHERE provider_id = $1
    `;

    const result = await this.pool.query(query, [providerId]);
    return parseInt(result.rows[0].count) || 0;
  }
}
