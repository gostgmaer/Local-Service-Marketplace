import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "@/common/database/database.module";
import { ProviderService } from "../entities/provider-service.entity";

@Injectable()
export class ProviderServiceRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(
    providerId: string,
    categoryId: string,
  ): Promise<ProviderService> {
    const query = `
      INSERT INTO provider_services (provider_id, category_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await this.pool.query(query, [providerId, categoryId]);
    return result.rows[0];
  }

  async findByProviderId(providerId: string): Promise<ProviderService[]> {
    const query = `
      SELECT ps.id, ps.provider_id, ps.category_id,
             sc.name AS category_name, sc.icon AS category_icon
      FROM provider_services ps
      LEFT JOIN service_categories sc ON sc.id = ps.category_id
      WHERE ps.provider_id = $1
      ORDER BY ps.id
    `;
    const result = await this.pool.query(query, [providerId]);
    return result.rows;
  }

  async deleteByProviderId(providerId: string): Promise<void> {
    const query = "DELETE FROM provider_services WHERE provider_id = $1";
    await this.pool.query(query, [providerId]);
  }

  async deleteById(serviceId: string): Promise<void> {
    const query = "DELETE FROM provider_services WHERE id = $1";
    await this.pool.query(query, [serviceId]);
  }

  async replaceServices(
    providerId: string,
    categoryIds: string[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Delete existing services
      await client.query(
        "DELETE FROM provider_services WHERE provider_id = $1",
        [providerId],
      );

      // Insert new services
      if (categoryIds.length > 0) {
        const values = categoryIds
          .map((_, idx) => `($1, $${idx + 2})`)
          .join(", ");
        const query = `INSERT INTO provider_services (provider_id, category_id) VALUES ${values}`;
        await client.query(query, [providerId, ...categoryIds]);
      }

      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
