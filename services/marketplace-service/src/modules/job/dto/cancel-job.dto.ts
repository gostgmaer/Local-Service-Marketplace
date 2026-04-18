import { IsString, IsEnum, IsOptional, MinLength } from "class-validator";

export class CancelJobDto {
  @IsOptional()
  @IsEnum(["customer", "provider", "admin"])
  cancelled_by?: "customer" | "provider" | "admin";

  @IsString()
  @MinLength(5)
  reason: string;
}
