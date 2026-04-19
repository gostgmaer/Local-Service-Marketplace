import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsDateString,
} from "class-validator";
import { Type, Transform } from "class-transformer";

export enum RequestSortBy {
  CREATED_AT = "created_at",
  BUDGET = "budget",
  PREFERRED_DATE = "preferred_date",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export enum RequestStatus {
  OPEN = "open",
  ASSIGNED = "assigned",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum RequestUrgency {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export class RequestQueryDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  min_budget?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  max_budget?: number;

  @IsOptional()
  @IsEnum(RequestUrgency)
  urgency?: RequestUrgency;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;

  @IsOptional()
  @IsEnum(RequestSortBy)
  sortBy?: RequestSortBy = RequestSortBy.CREATED_AT;

  // snake_case alias accepted from API clients
  @IsOptional()
  @IsEnum(RequestSortBy)
  @Transform(({ value, obj }) => {
    if (value !== undefined) obj.sortBy = value;
    return value;
  })
  sort_by?: RequestSortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  // snake_case alias accepted from API clients
  @IsOptional()
  @IsEnum(SortOrder)
  @Transform(({ value, obj }) => {
    if (value !== undefined) obj.sortOrder = value;
    return value;
  })
  sort_order?: SortOrder;

  // Internal-only: set by service layer for provider RBAC filtering.
  // Not exposed as a query param (forbidden by validation pipe).
  provider_user_id?: string;
}
