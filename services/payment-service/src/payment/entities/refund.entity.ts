export class Refund {
  id: string;
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;

  constructor(partial: Partial<Refund>) {
    Object.assign(this, partial);
  }
}
