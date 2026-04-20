import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdatePricingPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(["monthly", "yearly"])
  billing_period?: "monthly" | "yearly";

  @IsOptional()
  features?: any;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
