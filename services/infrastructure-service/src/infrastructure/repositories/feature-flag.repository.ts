import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { FeatureFlag } from '../entities/feature-flag.entity';
import { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';
import { FeatureFlagQueryDto, FeatureFlagSortBy } from "../dto/feature-flag-query.dto";
import { ResolvedPagination } from "../../common/pagination/list-query-validation.util";

@Injectable()
export class FeatureFlagRepository {
	constructor(@Inject("DATABASE_POOL") private readonly pool: Pool) {}

	async createFeatureFlag(createFlagDto: CreateFeatureFlagDto): Promise<FeatureFlag> {
		const query = `
      INSERT INTO feature_flags (key, enabled, rollout_percentage)
      VALUES ($1, $2, $3)
      RETURNING key, enabled, rollout_percentage
    `;

		const values = [createFlagDto.key, createFlagDto.enabled, createFlagDto.rollout_percentage];

		const result = await this.pool.query(query, values);
		return result.rows[0];
	}

	async getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
		const query = `
      SELECT key, enabled, rollout_percentage
      FROM feature_flags
      WHERE key = $1
    `;

		const result = await this.pool.query(query, [key]);
		return result.rows[0] || null;
	}

	async getAllFeatureFlags(): Promise<FeatureFlag[]> {
		const query = `
      SELECT key, enabled, rollout_percentage
      FROM feature_flags
      ORDER BY key ASC
    `;

		const result = await this.pool.query(query);
		return result.rows;
	}

	async findFeatureFlags(queryDto: FeatureFlagQueryDto, pagination: ResolvedPagination): Promise<FeatureFlag[]> {
		const { whereClause, values, nextIndex } = this.buildWhereClause(queryDto);
		const sortColumn = this.getSortColumn(queryDto.sortBy);
		const sortOrder = queryDto.sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

		const query = `
      SELECT key, enabled, rollout_percentage
      FROM feature_flags
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}, key ${sortOrder}
      LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

		const result = await this.pool.query(query, [...values, pagination.limit, pagination.offset]);
		return result.rows;
	}

	async countFeatureFlags(queryDto: FeatureFlagQueryDto): Promise<number> {
		const { whereClause, values } = this.buildWhereClause(queryDto);
		const query = `SELECT COUNT(*)::int AS total FROM feature_flags ${whereClause}`;
		const result = await this.pool.query(query, values);
		return result.rows[0]?.total || 0;
	}

	async updateFeatureFlag(key: string, updateFlagDto: UpdateFeatureFlagDto): Promise<FeatureFlag | null> {
		const updates: string[] = [];
		const values: any[] = [];
		let paramCount = 1;

		if (updateFlagDto.enabled !== undefined) {
			updates.push(`enabled = $${paramCount++}`);
			values.push(updateFlagDto.enabled);
		}

		if (updateFlagDto.rolloutPercentage !== undefined) {
			updates.push(`rollout_percentage = $${paramCount++}`);
			values.push(updateFlagDto.rolloutPercentage);
		}

		if (updates.length === 0) {
			return this.getFeatureFlagByKey(key);
		}

		values.push(key);

		const query = `
      UPDATE feature_flags
      SET ${updates.join(", ")}
      WHERE key = $${paramCount}
      RETURNING key, enabled, rollout_percentage as "rolloutPercentage"
    `;

		const result = await this.pool.query(query, values);
		return result.rows[0] || null;
	}

	async deleteFeatureFlag(key: string): Promise<void> {
		const query = `DELETE FROM feature_flags WHERE key = $1`;
		await this.pool.query(query, [key]);
	}

	async getEnabledFeatureFlags(): Promise<FeatureFlag[]> {
		const query = `
      SELECT key, enabled, rollout_percentage as "rolloutPercentage"
      FROM feature_flags
      WHERE enabled = true
      ORDER BY key ASC
    `;

		const result = await this.pool.query(query);
		return result.rows;
	}

	private buildWhereClause(queryDto: FeatureFlagQueryDto): {
		whereClause: string;
		values: unknown[];
		nextIndex: number;
	} {
		const conditions: string[] = [];
		const values: unknown[] = [];

		if (queryDto.search) {
			values.push(`%${queryDto.search}%`);
			conditions.push(`key ILIKE $${values.length}`);
		}

		if (queryDto.enabled !== undefined) {
			values.push(queryDto.enabled === "true");
			conditions.push(`enabled = $${values.length}`);
		}

		if (queryDto.minRolloutPercentage !== undefined) {
			values.push(queryDto.minRolloutPercentage);
			conditions.push(`rollout_percentage >= $${values.length}`);
		}

		if (queryDto.maxRolloutPercentage !== undefined) {
			values.push(queryDto.maxRolloutPercentage);
			conditions.push(`rollout_percentage <= $${values.length}`);
		}

		return {
			whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
			values,
			nextIndex: values.length + 1,
		};
	}

	private getSortColumn(sortBy?: FeatureFlagSortBy): string {
		switch (sortBy) {
			case FeatureFlagSortBy.ENABLED:
				return "enabled";
			case FeatureFlagSortBy.ROLLOUT_PERCENTAGE:
				return "rollout_percentage";
			case FeatureFlagSortBy.KEY:
			default:
				return "key";
		}
	}
}
