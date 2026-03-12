import { IsNotEmpty, IsString, IsInt, Min, Max, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsUUID()
  jobId: string;

  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsUUID()
  providerId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsNotEmpty()
  @IsString()
  comment: string;
}
