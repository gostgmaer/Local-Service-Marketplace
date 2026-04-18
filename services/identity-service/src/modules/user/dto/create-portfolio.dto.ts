import {
  IsString,
  IsOptional,
  IsUrl,
  IsNumber,
  MinLength,
} from "class-validator";

export class CreatePortfolioDto {
  // Injected from URL param :providerId — not validated from body
  @IsOptional()
  @IsString()
  provider_id?: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Injected from uploaded file URL — not validated from body
  @IsOptional()
  @IsUrl()
  image_url?: string;

  @IsOptional()
  @IsNumber()
  display_order?: number;
}
