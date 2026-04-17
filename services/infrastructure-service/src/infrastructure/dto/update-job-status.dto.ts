import { IsNotEmpty, IsString, IsIn, IsOptional } from "class-validator";

export class UpdateJobStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(["pending", "processing", "completed", "failed"])
  status: string;

  @IsOptional()
  @IsString()
  error?: string;
}
