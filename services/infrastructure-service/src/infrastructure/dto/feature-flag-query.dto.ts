import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ListQueryDto } from "./list-query.dto";

export enum FeatureFlagSortBy {
	KEY = "key",
	ENABLED = "enabled",
	ROLLOUT_PERCENTAGE = "rolloutPercentage",
}

export class FeatureFlagQueryDto extends ListQueryDto {
	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@IsBooleanString()
	enabled?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	minRolloutPercentage?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	maxRolloutPercentage?: number;

	@IsOptional()
	@IsEnum(FeatureFlagSortBy)
	sortBy?: FeatureFlagSortBy = FeatureFlagSortBy.KEY;
}
