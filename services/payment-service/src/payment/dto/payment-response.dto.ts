export class PaymentResponseDto {
  id: string;
  job_id: string;
  user_id: string;
  provider_id: string;
  amount: number;
  platform_fee: number;
  provider_amount: number;
  currency: string;
  payment_method?: string;
  status: string;
  transaction_id?: string;
  failed_reason?: string;
  created_at: string;
  updated_at: string;
}
