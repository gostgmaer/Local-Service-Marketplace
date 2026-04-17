import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ListQueryDto } from "./list-query.dto";

export enum BackgroundJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum BackgroundJobSortBy {
  CREATED_AT = "createdAt",
  SCHEDULED_FOR = "scheduledFor",
  STATUS = "status",
  ATTEMPTS = "attempts",
  JOB_TYPE = "jobType",
}

export class BackgroundJobQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @IsEnum(BackgroundJobStatus)
  status?: BackgroundJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAttempts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledTo?: Date;

  @IsOptional()
  @IsEnum(BackgroundJobSortBy)
  sortBy?: BackgroundJobSortBy = BackgroundJobSortBy.SCHEDULED_FOR;
}
