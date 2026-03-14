export class PaymentWebhook {
  id: string;
  gateway: string;
  payload: Record<string, any>;
  processed: boolean;
  event_type?: string;
  external_id?: string;
  created_at: Date;
  processed_at?: Date;

  constructor(partial: Partial<PaymentWebhook>) {
    Object.assign(this, partial);
  }
}
