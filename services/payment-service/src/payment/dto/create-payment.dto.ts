import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  jobId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
