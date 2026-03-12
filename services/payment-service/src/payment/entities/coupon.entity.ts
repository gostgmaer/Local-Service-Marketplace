export class Coupon {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt?: Date;

  constructor(partial: Partial<Coupon>) {
    Object.assign(this, partial);
  }
}
