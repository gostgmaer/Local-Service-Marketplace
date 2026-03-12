export class CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  usedAt: Date;

  constructor(partial: Partial<CouponUsage>) {
    Object.assign(this, partial);
  }
}
