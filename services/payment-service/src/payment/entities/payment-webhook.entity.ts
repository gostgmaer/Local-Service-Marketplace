export class PaymentWebhook {
  id: string;
  gateway: string;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: Date;

  constructor(partial: Partial<PaymentWebhook>) {
    Object.assign(this, partial);
  }
}
