import { IsNotEmpty, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateFeatureFlagDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  rollout_percentage: number = 100;
}
