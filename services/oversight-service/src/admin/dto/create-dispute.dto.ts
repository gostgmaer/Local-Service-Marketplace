import {
  IsUUID,
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class EvidenceImageDto {
  @IsString()
  id: string;

  @IsString()
  url: string;
}

export class CreateDisputeDto {
  @IsUUID()
  job_id: string;

  @IsString()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceImageDto)
  evidence_images?: EvidenceImageDto[];
}
