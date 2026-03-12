import { IsNotEmpty, IsString } from 'class-validator';

export class CheckRateLimitDto {
  @IsNotEmpty()
  @IsString()
  key: string;
}
