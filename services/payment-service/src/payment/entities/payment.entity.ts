export class Payment {
  id: string;
  jobId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  createdAt: Date;

  constructor(partial: Partial<Payment>) {
    Object.assign(this, partial);
  }
}
