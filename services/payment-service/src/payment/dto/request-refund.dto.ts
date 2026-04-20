import { IsNumber, IsString, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class RequestRefundDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number; // Optional - defaults to full payment amount

  @IsString()
  reason: string;
}
