import { IsString, IsOptional, IsObject, IsArray } from "class-validator";

export class BroadcastDto {
  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  relatedIds?: {
    requestId?: string;
    jobId?: string;
    providerId?: string;
    customerId?: string;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rooms?: string[];

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
