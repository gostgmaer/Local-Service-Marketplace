import { IsUUID, IsNumber, IsString, IsOptional, Min, IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  job_id: string;

  @IsUUID()
  user_id: string;

  @IsUUID()
  provider_id: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['USD', 'EUR', 'GBP', 'INR'])
  currency: string;

  @IsOptional()
  @IsEnum(['card', 'bank_transfer', 'wallet', 'cash'])
  payment_method?: 'card' | 'bank_transfer' | 'wallet' | 'cash';

  @IsOptional()
  @IsString()
  coupon_code?: string;
}
