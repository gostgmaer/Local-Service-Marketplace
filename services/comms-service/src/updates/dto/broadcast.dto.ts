import { IsString, IsOptional, IsObject } from "class-validator";

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
  rooms?: string[];
}
