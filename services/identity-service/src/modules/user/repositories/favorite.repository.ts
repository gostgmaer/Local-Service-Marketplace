import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "@/common/database/database.module";
import { Favorite } from "../entities/favorite.entity";
import { resolveId } from "@/common/utils/resolve-id.util";

@Injectable()
export class FavoriteRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(userId: string, providerId: string): Promise<Favorite> {
    [userId, providerId] = await Promise.all([
      resolveId(this.pool, "users", userId),
      resolveId(this.pool, "providers", providerId),
    ]);
    const query = `
      INSERT INTO favorites (user_id, provider_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, provider_id) DO NOTHING
      RETURNING *
    `;
    const result = await this.pool.query(query, [userId, providerId]);
    return result.rows[0];
  }

  async findByUserId(userId: string): Promise<Favorite[]> {
    userId = await resolveId(this.pool, "users", userId);
    const query = `
      SELECT f.*, p.business_name, p.description, p.rating
      FROM favorites f
      INNER JOIN providers p ON f.provider_id = p.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  async findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number,
    sortBy: string,
    sortOrder: string,
  ): Promise<{ rows: Favorite[]; total: number }> {
    userId = await resolveId(this.pool, "users", userId);
    const allowedSortBy = ["created_at", "business_name", "rating"];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : "created_at";
    const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";
    const sortCol =
      safeSortBy === "created_at" ? "f.created_at" : `p.${safeSortBy}`;

    const query = `
      SELECT f.*, p.business_name, p.description, p.rating,
             COUNT(*) OVER() AS total_count
      FROM favorites f
      INNER JOIN providers p ON f.provider_id = p.id
      WHERE f.user_id = $1
      ORDER BY ${sortCol} ${safeOrder}
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [userId, limit, offset]);
    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    return { rows: result.rows, total };
  }

  async findOne(userId: string, providerId: string): Promise<Favorite | null> {
    [userId, providerId] = await Promise.all([
      resolveId(this.pool, "users", userId),
      resolveId(this.pool, "providers", providerId),
    ]);
    const query =
      "SELECT * FROM favorites WHERE user_id = $1 AND provider_id = $2";
    const result = await this.pool.query(query, [userId, providerId]);
    return result.rows[0] || null;
  }

  async delete(userId: string, providerId: string): Promise<void> {
    [userId, providerId] = await Promise.all([
      resolveId(this.pool, "users", userId),
      resolveId(this.pool, "providers", providerId),
    ]);
    const query =
      "DELETE FROM favorites WHERE user_id = $1 AND provider_id = $2";
    await this.pool.query(query, [userId, providerId]);
  }
}
