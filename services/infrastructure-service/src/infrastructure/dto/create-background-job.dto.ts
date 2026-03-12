import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateBackgroundJobDto {
  @IsNotEmpty()
  @IsString()
  jobType: string;

  @IsOptional()
  @IsObject()
  payload?: any;
}
