import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateVerificationStatusDto {
  @IsEnum(["pending", "verified", "rejected"])
  status: "pending" | "verified" | "rejected";

  @IsOptional()
  @IsString()
  reason?: string;
}
