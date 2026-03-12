import { IsString, IsNumber, IsUUID, IsOptional, MinLength, Min } from 'class-validator';

export class CreateRequestDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  category_id: string;

  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsNumber()
  @Min(0)
  budget: number;
}
