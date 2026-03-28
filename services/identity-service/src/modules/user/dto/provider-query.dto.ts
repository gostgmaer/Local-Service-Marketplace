import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ProviderQueryDto {
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	limit?: number = 20;

	@IsOptional()
	@IsNumber()
	@Min(1)
	@Type(() => Number)
	page?: number;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsOptional()
	@IsString()
	category_id?: string;

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@IsString()
	location_id?: string;
}
