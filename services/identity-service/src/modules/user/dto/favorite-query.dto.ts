import { IsOptional, IsNumber, IsEnum, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export enum FavoriteSortBy {
  CREATED_AT = "created_at",
  PROVIDER_NAME = "business_name",
  RATING = "rating",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class FavoriteQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsEnum(FavoriteSortBy)
  sortBy?: FavoriteSortBy = FavoriteSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
